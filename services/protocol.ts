import { A2AMessage, A2AMessageType, A2AHeader, IdentityState, UCPT } from '../types';
import { CryptoService } from './crypto';

// ANÓTEROS LÓGOS PROTOCOL STACK
// Implements serialization, signing, and verification for AEA communication.

export class ProtocolStack {
  
  /**
   * Encapsulates a payload into a signed A2A Envelope.
   */
  public static async packMessage<T>(
    sender: IdentityState,
    recipientDid: string,
    type: A2AMessageType,
    payload: T
  ): Promise<A2AMessage<T>> {
    
    const header: A2AHeader = {
      version: "1.0",
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      sender_did: sender.did,
      recipient_did: recipientDid,
      type: type,
      nonce: Math.floor(Math.random() * 1000000)
    };

    // Construct Canonical Signing Input: Header + Payload
    const signInput = CryptoService.canonicalize({ header, payload });
    const signature = await CryptoService.signDataEd25519(signInput, null);

    return {
      header,
      payload,
      signature
    };
  }

  /**
   * Verifies the integrity of an incoming A2A message.
   * Performs cryptographic verification of the Ed25519 signature.
   */
  public static async verifyMessage(msg: A2AMessage): Promise<boolean> {
    // 1. Check version
    if (msg.header.version !== "1.0") return false;
    // 2. Check timestamp freshness (allow 60s clock skew)
    if (Math.abs(Date.now() - msg.header.timestamp) > 60000) return false;
    
    // 3. Extract DID and Public Key
    // Format: did:key:z<HexPubKey>
    const senderDid = msg.header.sender_did;
    if (!senderDid.startsWith('did:key:z')) return false;
    
    const pubKeyHex = senderDid.replace('did:key:z', '');
    
    try {
        // Import the public key
        const publicKey = await CryptoService.importEd25519PublicKey(pubKeyHex);
        
        // Reconstruct Canonical Data
        const canonicalData = CryptoService.canonicalize({
            header: msg.header,
            payload: msg.payload
        });
        
        // Verify
        const isValid = await CryptoService.verifyDataEd25519(publicKey, msg.signature, canonicalData);
        return isValid;

    } catch (e) {
        console.error("Signature Verification Error", e);
        return false;
    }
  }

  /**
   * Mints a Universal Computational Proof Token (UCPT).
   * This serves as the "Proof of Work" in the Anóteros Lógos system.
   */
  public static async mintUCPT(
    identity: IdentityState,
    taskType: string,
    target: string,
    resourceCost: string
  ): Promise<UCPT> {
    const targetHash = await this.hashTarget(target);
    
    const credentialSubject = {
      taskType,
      targetHash,
      executionTimeMs: Date.now(), // Rough approx
      resourceCost
    };

    // Sign the credential subject
    const subjectCanonical = CryptoService.canonicalize(credentialSubject);
    const signature = await CryptoService.signDataEd25519(subjectCanonical, null);

    return {
      id: `ucpt:${crypto.randomUUID()}`,
      context: ["https://anoteroslogos.com/ucpt/v1"],
      issuer: identity.did,
      issuanceDate: new Date().toISOString(),
      credentialSubject,
      proof: {
        type: "Ed25519Signature2020",
        created: new Date().toISOString(),
        verificationMethod: `${identity.did}#keys-1`,
        proofPurpose: "assertionMethod",
        jws: signature
      }
    };
  }

  /**
   * Cryptographically verifies a Universal Computational Proof Token (UCPT).
   * Ensures the credential subject was signed by the issuer's private key.
   * Adheres to the Anóteros Lógos Ed25519Signature2020 implementation.
   */
  public static async verifyUCPT(ucpt: UCPT): Promise<boolean> {
    // 1. Structure & Context Validation
    if (!ucpt.proof || ucpt.proof.type !== "Ed25519Signature2020") {
        console.warn("UCPT Validation Failed: Unsupported Proof Suite or Missing Proof");
        return false;
    }
    
    // 2. Issuer Identity Extraction (DID:KEY Resolution)
    // Scheme: did:key:z<HexEncodedEd25519PubKey>
    const issuerDid = ucpt.issuer;
    if (!issuerDid.startsWith('did:key:z')) {
        console.warn("UCPT Validation Failed: Unsupported DID Method");
        return false;
    }
    
    // Extract raw hex public key from DID
    const pubKeyHex = issuerDid.replace('did:key:z', '');

    try {
        // 3. Public Key Import
        const publicKey = await CryptoService.importEd25519PublicKey(pubKeyHex);
        
        // 4. Reconstruction of Signed Payload
        // The signature covers the canonicalized Credential Subject
        const canonicalSubject = CryptoService.canonicalize(ucpt.credentialSubject);
        
        // 5. Ed25519 Verification
        const signatureHex = ucpt.proof.jws;
        
        // CryptoService.verifyDataEd25519 expects (CryptoKey, signatureHex, dataString)
        const isValid = await CryptoService.verifyDataEd25519(
            publicKey, 
            signatureHex, 
            canonicalSubject
        );

        return isValid;

    } catch (e) {
        console.error("UCPT Verification Critical Failure:", e);
        return false;
    }
  }

  private static async hashTarget(input: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return '0x' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
}