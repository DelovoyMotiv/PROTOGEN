import { IdentityState, WalletState } from '../types';
import { CryptoService } from './crypto';
import { persistenceService } from './persistence';
import { blockchainService } from './blockchain';
import { privateKeyToAccount } from 'viem/accounts';
import { serializeTransaction, parseEther } from 'viem';
import * as crypto from 'crypto';

const STORAGE_KEY_BALANCE = 'protogen_balance';
const STORAGE_KEY_NONCE = 'protogen_nonce';
const PBKDF2_ITERATIONS = 100000;
const PBKDF2_KEYLEN = 32; // 256 bits for AES-256
const PBKDF2_DIGEST = 'sha256';

interface EncryptedVault {
  version: number;
  algorithm: 'AES-256-GCM';
  kdf: 'PBKDF2';
  iterations: number;
  salt: string;            // Hex-encoded
  iv: string;              // Hex-encoded
  ciphertext: string;      // Hex-encoded
  authTag: string;         // Hex-encoded
  createdAt: number;
  lastAccessed: number;
  backupCount: number;
}

interface VaultPayload {
  evmPrivateKey: string;
  edJWK: string;
  edPublicKeyHex: string;
}

// Storage Adapter to handle Browser (localStorage) vs Node (In-Memory/Env)
class StorageAdapter {
  private static memoryStore: Record<string, string> = {};

  static getItem(key: string): string | null {
    if (typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem(key);
    }
    return this.memoryStore[key] || null;
  }

  static setItem(key: string, value: string) {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(key, value);
    } else {
      this.memoryStore[key] = value;
    }
  }

  static removeItem(key: string) {
      if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.removeItem(key);
      } else {
          delete this.memoryStore[key];
      }
  }
}

export class IdentityModule {
  private identity: IdentityState | null = null;
  private edKeyPair: CryptoKeyPair | null = null;
  private wallet: WalletState = {
    address: '0x0000000000000000000000000000000000000000',
    balanceUSDC: 0,
    balanceCCC: 0,
    network: 'Base L2',
    chainId: 8453,
    nonce: 0
  };

  public async initialize() {
    await CryptoService.initSecureStorage();
    const vault = await persistenceService.loadIdentity();
    
    if (vault) {
      try {
        // Decrypt vault using PBKDF2-derived key
        const payload = await this.decryptVault(vault);
        
        const account = privateKeyToAccount(payload.evmPrivateKey as `0x${string}`);
        
        const jwk = JSON.parse(payload.edJWK);
        const imported = await CryptoService.importEd25519Key(jwk);
        const pubKey = await CryptoService.importEd25519PublicKey(payload.edPublicKeyHex);
        
        this.edKeyPair = {
          privateKey: imported.keyPair.privateKey,
          publicKey: pubKey
        };

        this.identity = {
          privateKey: payload.evmPrivateKey,
          address: account.address,
          did: `did:key:z${payload.edPublicKeyHex}`,
          ed25519PublicKey: payload.edPublicKeyHex
        };

        // Update last accessed timestamp
        vault.lastAccessed = Date.now();
        await persistenceService.storeIdentity(vault);

      } catch (e) {
        console.error("Identity Unlock Failed:", e);
        // Do not auto-regenerate if unlocking fails; that destroys the account.
        // User must explicitly reset if they lost keys.
        return; 
      }
    } else {
      await this.createFreshIdentity();
    }

    this.wallet.address = this.identity?.address || this.wallet.address;
    
    // Load real balance from blockchain
    if (this.identity?.address) {
      await this.refreshBalance();
    }
    
    // Load nonce from persistence (or blockchain)
    const storedNonce = await persistenceService.loadState(STORAGE_KEY_NONCE);
    this.wallet.nonce = storedNonce ? parseInt(storedNonce) : 0;
  }

  public async refreshBalance(): Promise<void> {
    if (!this.identity?.address) {
      console.warn('Cannot refresh balance: No identity');
      return;
    }

    try {
      // Query real USDC balance from Base L2
      const usdcBalance = await blockchainService.getUSDCBalance(this.identity.address);
      const usdcFormatted = blockchainService.formatUSDC(usdcBalance);
      this.wallet.balanceUSDC = parseFloat(usdcFormatted);
      
      // Cache balance to persistence for offline access
      await persistenceService.saveState(STORAGE_KEY_BALANCE, this.wallet.balanceUSDC.toFixed(2));
      
      console.log(`Balance refreshed: ${this.wallet.balanceUSDC.toFixed(2)} USDC`);
    } catch (error: any) {
      console.warn('Failed to refresh balance from blockchain, using cached:', error.message);
      
      // Fallback to cached balance
      const cachedBal = await persistenceService.loadState(STORAGE_KEY_BALANCE);
      if (cachedBal) {
        this.wallet.balanceUSDC = parseFloat(cachedBal);
      } else {
        // Ultimate fallback for development
        this.wallet.balanceUSDC = 0;
        console.error('No cached balance available. Agent may be unable to operate.');
      }
    }
  }

  private async createFreshIdentity() {
    const evm = CryptoService.generateEVMIdentity();
    const { publicKeyHex, keyPair } = await CryptoService.generateEd25519Identity();
    const jwk = await CryptoService.exportEd25519Key(keyPair);
    
    const payload: VaultPayload = {
      evmPrivateKey: evm.privateKey,
      edJWK: JSON.stringify(jwk),
      edPublicKeyHex: publicKeyHex
    };
    
    // Encrypt and store vault
    const vault = await this.encryptVault(payload);
    await persistenceService.storeIdentity(vault);
    
    this.edKeyPair = keyPair;
    this.identity = {
      privateKey: evm.privateKey,
      address: evm.address,
      did: `did:key:z${publicKeyHex}`,
      ed25519PublicKey: publicKeyHex
    };
  }

  private async encryptVault(payload: VaultPayload): Promise<EncryptedVault> {
    // Generate cryptographically secure salt
    const salt = crypto.randomBytes(32);
    
    // Derive key using PBKDF2 with 100k iterations
    // In production, password should come from secure source (HSM, KMS, user input)
    // For autonomous agent, we use machine-specific entropy
    const password = await this.getMachinePassword();
    const key = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST);
    
    // Generate random IV for AES-GCM
    const iv = crypto.randomBytes(12); // 96 bits for GCM
    
    // Encrypt payload
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const payloadJson = JSON.stringify(payload);
    let ciphertext = cipher.update(payloadJson, 'utf8', 'hex');
    ciphertext += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    
    return {
      version: 1,
      algorithm: 'AES-256-GCM',
      kdf: 'PBKDF2',
      iterations: PBKDF2_ITERATIONS,
      salt: salt.toString('hex'),
      iv: iv.toString('hex'),
      ciphertext: ciphertext,
      authTag: authTag.toString('hex'),
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      backupCount: 0
    };
  }

  private async decryptVault(vault: EncryptedVault): Promise<VaultPayload> {
    // Validate vault version
    if (vault.version !== 1) {
      throw new Error(`Unsupported vault version: ${vault.version}`);
    }
    
    // Validate algorithm
    if (vault.algorithm !== 'AES-256-GCM' || vault.kdf !== 'PBKDF2') {
      throw new Error(`Unsupported encryption: ${vault.algorithm} with ${vault.kdf}`);
    }
    
    // Derive key using same parameters
    const password = await this.getMachinePassword();
    const salt = Buffer.from(vault.salt, 'hex');
    const key = crypto.pbkdf2Sync(password, salt, vault.iterations, PBKDF2_KEYLEN, PBKDF2_DIGEST);
    
    // Decrypt
    const iv = Buffer.from(vault.iv, 'hex');
    const authTag = Buffer.from(vault.authTag, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    
    let plaintext = decipher.update(vault.ciphertext, 'hex', 'utf8');
    plaintext += decipher.final('utf8');
    
    return JSON.parse(plaintext) as VaultPayload;
  }

  private async getMachinePassword(): Promise<string> {
    // In production, this should use:
    // 1. Hardware Security Module (HSM)
    // 2. Cloud KMS (AWS KMS, Google Cloud KMS)
    // 3. Kubernetes Secrets
    // 4. Environment variable from secure vault
    
    // For autonomous agent, derive from machine-specific entropy
    // This is a placeholder - in production use proper key management
    const machineId = process.env.MACHINE_ID || 'default-machine-id';
    const appSecret = process.env.VAULT_PASSWORD || 'protogen-vault-secret-change-in-production';
    
    // Combine machine ID and app secret
    return crypto.createHash('sha256').update(machineId + appSecret).digest('hex');
  }

  public lockSession() {
      this.identity = null;
      this.edKeyPair = null;
      // Note: We do not clear the VAULT from storage, only the decrypted keys from memory.
  }

  public getIdentity(): IdentityState | null {
    return this.identity;
  }

  public getWalletState(): WalletState {
    return this.wallet;
  }

  public setCCCBalance(balance: number) {
    this.wallet.balanceCCC = balance;
  }

  public async deductBalance(amount: number) {
    this.wallet.balanceUSDC -= amount;
    this.wallet.nonce += 1;
    await persistenceService.saveState(STORAGE_KEY_BALANCE, this.wallet.balanceUSDC.toFixed(2));
    await persistenceService.saveState(STORAGE_KEY_NONCE, this.wallet.nonce.toString());
  }

  public async signTransaction(to: string, amount: number): Promise<string> {
    if (!this.identity) throw new Error("Identity Locked or Not Initialized");

    const account = privateKeyToAccount(this.identity.privateKey as `0x${string}`);
    const val = parseEther(amount.toString());
    
    // Construct and sign EIP-1559 Transaction
    const transaction = {
      chainId: 8453,
      type: 'eip1559' as const,
      to: to as `0x${string}`,
      value: val,
      nonce: this.wallet.nonce,
      gas: 21000n,
      maxFeePerGas: 200000000n,
      maxPriorityFeePerGas: 10000000n,
    };

    const signature = await account.signTransaction(transaction);
    return signature;
  }

  public async signAttestation(message: string): Promise<string> {
    if (!this.edKeyPair) throw new Error("Keystore Locked");
    return CryptoService.signDataEd25519(message, this.edKeyPair);
  }
}

export const identityService = new IdentityModule();