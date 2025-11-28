import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { hexToBytes, toHex } from 'viem';

// Advanced Cryptographic Service
// - EVM: Secp256k1 via Viem
// - Identity: Ed25519 via WebCrypto API (globalThis.crypto for Node 22+)
// - Storage: AES-GCM Encryption
// - DHT: 160-bit XOR Arithmetic

export class CryptoService {
  private static edKeyPair: CryptoKeyPair | null = null;
  private static masterKey: CryptoKey | null = null;

  // Polyfill access to crypto for environment agnostic execution
  private static getCrypto(): Crypto {
    const c = globalThis.crypto;
    if (!c || !c.subtle) {
      throw new Error("Environment does not support WebCrypto API (Node 19+ or Modern Browser required)");
    }
    return c;
  }

  // --- INITIALIZATION & STORAGE SECURITY ---

  public static async initSecureStorage() {
    // In Node.js, we might load this from process.env or a file
    // In Browser, localStorage
    const isBrowser = typeof window !== 'undefined';
    let rawKey: string | null = null;

    if (isBrowser) {
      rawKey = localStorage.getItem('sys_kek');
    } else {
      // Mock persistent env var for Node simulation
      rawKey = process.env.SYS_KEK || null;
    }

    if (!rawKey) {
      const entropy = this.getCrypto().getRandomValues(new Uint8Array(32));
      rawKey = toHex(entropy);
      if (isBrowser) localStorage.setItem('sys_kek', rawKey);
    }
    
    const keyMaterial = hexToBytes(rawKey.startsWith('0x') ? rawKey as `0x${string}` : `0x${rawKey}`);
    this.masterKey = await this.getCrypto().subtle.importKey(
      "raw",
      keyMaterial,
      "AES-GCM",
      false,
      ["encrypt", "decrypt"]
    );
  }

  public static async encryptData(plaintext: string): Promise<string> {
    if (!this.masterKey) await this.initSecureStorage();
    const iv = this.getCrypto().getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(plaintext);
    
    const ciphertext = await this.getCrypto().subtle.encrypt(
      { name: "AES-GCM", iv },
      this.masterKey!,
      encoded
    );

    // toHex returns 0x-prefixed strings
    return `${toHex(iv)}:${toHex(new Uint8Array(ciphertext))}`;
  }

  public static async decryptData(encrypted: string): Promise<string> {
    if (!this.masterKey) await this.initSecureStorage();
    const [ivHex, cipherHex] = encrypted.split(':');
    if (!ivHex || !cipherHex) throw new Error("Invalid cipher format");

    // Handle potential double 0x or missing 0x robustness
    const iv = hexToBytes(ivHex.startsWith('0x') ? ivHex as `0x${string}` : `0x${ivHex}`);
    const ciphertext = hexToBytes(cipherHex.startsWith('0x') ? cipherHex as `0x${string}` : `0x${cipherHex}`);

    const decrypted = await this.getCrypto().subtle.decrypt(
      { name: "AES-GCM", iv },
      this.masterKey!,
      ciphertext
    );

    return new TextDecoder().decode(decrypted);
  }

  // --- EVM IDENTITY ---

  public static generateEVMIdentity() {
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);
    return {
      privateKey,
      address: account.address
    };
  }

  public static getAccountFromKey(privateKey: string) {
    return privateKeyToAccount(privateKey as `0x${string}`);
  }

  public static async signMessageEVM(privateKey: `0x${string}`, message: string): Promise<string> {
    const account = privateKeyToAccount(privateKey);
    return await account.signMessage({ message });
  }

  // --- DID IDENTITY (Ed25519) ---

  public static async generateEd25519Identity(): Promise<{ publicKeyHex: string; keyPair: CryptoKeyPair }> {
    const keyPair = await this.getCrypto().subtle.generateKey(
      {
        name: "Ed25519",
      },
      true, 
      ["sign", "verify"]
    ) as CryptoKeyPair;

    const pubKeyBuffer = await this.getCrypto().subtle.exportKey("raw", keyPair.publicKey);
    const publicKeyHex = toHex(new Uint8Array(pubKeyBuffer));

    this.edKeyPair = keyPair;
    return { publicKeyHex, keyPair };
  }

  public static async exportEd25519Key(keyPair: CryptoKeyPair): Promise<JsonWebKey> {
    return await this.getCrypto().subtle.exportKey("jwk", keyPair.privateKey);
  }

  public static async importEd25519Key(jwk: JsonWebKey): Promise<{ publicKeyHex: string; keyPair: CryptoKeyPair }> {
    const privateKey = await this.getCrypto().subtle.importKey(
      "jwk",
      jwk,
      { name: "Ed25519" },
      true,
      ["sign"]
    );

    return { 
        publicKeyHex: "", 
        keyPair: { privateKey, publicKey: {} as CryptoKey } 
    };
  }
  
  public static async importEd25519PublicKey(hex: string): Promise<CryptoKey> {
      const buffer = hexToBytes(hex.startsWith('0x') ? hex as `0x${string}` : `0x${hex}`);
      return await this.getCrypto().subtle.importKey(
          "raw",
          buffer,
          { name: "Ed25519" },
          true,
          ["verify"]
      );
  }

  public static async signDataEd25519(data: string, keyPair: CryptoKeyPair | null): Promise<string> {
    const activeKey = keyPair || this.edKeyPair;
    if (!activeKey || !activeKey.privateKey) throw new Error("Keystore locked");

    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const signature = await this.getCrypto().subtle.sign(
      { name: "Ed25519" },
      activeKey.privateKey,
      dataBuffer
    );
    return toHex(new Uint8Array(signature));
  }

  public static async verifyDataEd25519(publicKey: CryptoKey, signatureHex: string, data: string): Promise<boolean> {
      const signature = hexToBytes(signatureHex.startsWith('0x') ? signatureHex as `0x${string}` : `0x${signatureHex}`);
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(data);
      
      return await this.getCrypto().subtle.verify(
          { name: "Ed25519" },
          publicKey,
          signature,
          dataBuffer
      );
  }

  // --- PROTOCOL UTILS ---

  public static canonicalize(obj: any): string {
    if (obj === null || typeof obj !== 'object') {
      return JSON.stringify(obj);
    }
    
    if (Array.isArray(obj)) {
      return '[' + obj.map(item => this.canonicalize(item)).join(',') + ']';
    }
    
    const keys = Object.keys(obj).sort();
    const parts = keys.map(key => {
      return `"${key}":${this.canonicalize(obj[key])}`;
    });
    
    return '{' + parts.join(',') + '}';
  }

  // --- NETWORK PRIMITIVES ---

  public static calculateDistance(id1: string, id2: string): bigint {
    const b1 = hexToBytes(id1.startsWith('0x') ? id1 as `0x${string}` : `0x${id1}`);
    const b2 = hexToBytes(id2.startsWith('0x') ? id2 as `0x${string}` : `0x${id2}`);
    
    let distance = 0n;
    for (let i = 0; i < Math.min(b1.length, b2.length); i++) {
        distance = (distance << 8n) | BigInt(b1[i] ^ b2[i]);
    }
    return distance;
  }

  public static getBucketIndex(id1: string, id2: string): number {
    const b1 = hexToBytes(id1.startsWith('0x') ? id1 as `0x${string}` : `0x${id1}`);
    const b2 = hexToBytes(id2.startsWith('0x') ? id2 as `0x${string}` : `0x${id2}`);
    const len = Math.min(b1.length, b2.length);
    const bits = len * 8;

    for (let i = 0; i < len; i++) {
        const xor = b1[i] ^ b2[i];
        if (xor !== 0) {
            const leadingZerosInByte = Math.clz32(xor) - 24;
            const sharedPrefixLength = (i * 8) + leadingZerosInByte;
            return (bits - 1) - sharedPrefixLength;
        }
    }
    return -1; 
  }
}