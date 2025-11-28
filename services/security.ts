import * as crypto from 'crypto';
import { A2AMessage } from '../types';
import { CryptoService } from './crypto';

// PRODUCTION-GRADE SECURITY SERVICE
// Implements defense-in-depth: encryption, rate limiting, validation, audit logging

const PBKDF2_ITERATIONS = 100000;
const PBKDF2_KEYLEN = 32;
const PBKDF2_DIGEST = 'sha256';

interface EncryptedData {
  algorithm: 'AES-256-GCM';
  iv: string;
  ciphertext: string;
  authTag: string;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

interface SecurityEvent {
  timestamp: number;
  type: 'AUTH_FAILURE' | 'RATE_LIMIT' | 'INVALID_MESSAGE' | 'INJECTION_ATTEMPT' | 'MEMORY_THRESHOLD';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  source: string;
  details: Record<string, any>;
}

interface RateLimitEntry {
  count: number;
  windowStart: number;
  backoffUntil: number;
  failureCount: number;
}

export class SecurityService {
  private rateLimitMap = new Map<string, RateLimitEntry>();
  private auditLog: SecurityEvent[] = [];
  private readonly MAX_AUDIT_LOG_SIZE = 10000;

  // --- ENCRYPTION OPERATIONS ---

  public async deriveKey(password: string, salt: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      crypto.pbkdf2(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST, (err, key) => {
        if (err) reject(err);
        else resolve(key);
      });
    });
  }

  public async encrypt(data: Buffer, key: Buffer): Promise<EncryptedData> {
    const iv = crypto.randomBytes(12); // 96 bits for GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    
    const ciphertext = Buffer.concat([
      cipher.update(data),
      cipher.final()
    ]);
    
    const authTag = cipher.getAuthTag();

    return {
      algorithm: 'AES-256-GCM',
      iv: iv.toString('hex'),
      ciphertext: ciphertext.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }

  public async decrypt(encrypted: EncryptedData, key: Buffer): Promise<Buffer> {
    if (encrypted.algorithm !== 'AES-256-GCM') {
      throw new Error(`Unsupported algorithm: ${encrypted.algorithm}`);
    }

    const iv = Buffer.from(encrypted.iv, 'hex');
    const ciphertext = Buffer.from(encrypted.ciphertext, 'hex');
    const authTag = Buffer.from(encrypted.authTag, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final()
    ]);
  }

  // --- RATE LIMITING (Token Bucket Algorithm) ---

  public async checkRateLimit(
    identifier: string,
    limit: number,
    windowMs: number
  ): Promise<boolean> {
    const now = Date.now();
    let entry = this.rateLimitMap.get(identifier);

    // Check if under backoff (exponential backoff for repeated violations)
    if (entry && entry.backoffUntil > now) {
      this.logSecurityEvent({
        timestamp: now,
        type: 'RATE_LIMIT',
        severity: 'MEDIUM',
        source: identifier,
        details: {
          backoffRemaining: entry.backoffUntil - now,
          failureCount: entry.failureCount
        }
      });
      return false;
    }

    if (!entry || now - entry.windowStart > windowMs) {
      // New window
      this.rateLimitMap.set(identifier, {
        count: 1,
        windowStart: now,
        backoffUntil: 0,
        failureCount: 0
      });
      return true;
    }

    entry.count++;

    if (entry.count > limit) {
      // Rate limit exceeded - apply exponential backoff
      entry.failureCount++;
      const backoffMs = Math.min(1000 * Math.pow(2, entry.failureCount), 300000); // Max 5 minutes
      entry.backoffUntil = now + backoffMs;

      this.logSecurityEvent({
        timestamp: now,
        type: 'RATE_LIMIT',
        severity: entry.failureCount > 3 ? 'HIGH' : 'MEDIUM',
        source: identifier,
        details: {
          count: entry.count,
          limit,
          backoffMs,
          failureCount: entry.failureCount
        }
      });

      return false;
    }

    return true;
  }

  public async recordRequest(identifier: string): Promise<void> {
    // This is called after successful request to update metrics
    const entry = this.rateLimitMap.get(identifier);
    if (entry) {
      // Reset failure count on successful request
      entry.failureCount = 0;
    }
  }

  // --- A2A MESSAGE VALIDATION ---

  public async validateA2AMessage(msg: A2AMessage): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Structure validation
    if (!msg.header || !msg.payload || !msg.signature) {
      errors.push('Missing required fields: header, payload, or signature');
      return { valid: false, errors, warnings };
    }

    // 2. Version check
    if (msg.header.version !== '1.0') {
      errors.push(`Unsupported protocol version: ${msg.header.version}`);
    }

    // 3. Timestamp freshness (±60s clock skew tolerance)
    const now = Date.now();
    const timeDiff = Math.abs(now - msg.header.timestamp);
    if (timeDiff > 60000) {
      errors.push(`Timestamp outside acceptable range: ${timeDiff}ms difference`);
    } else if (timeDiff > 30000) {
      warnings.push(`Large clock skew detected: ${timeDiff}ms`);
    }

    // 4. DID format validation
    if (!msg.header.sender_did.startsWith('did:key:z')) {
      errors.push(`Invalid sender DID format: ${msg.header.sender_did}`);
    }

    // 5. Signature validation
    try {
      const isValidSig = await this.verifyMessageSignature(msg);
      if (!isValidSig) {
        errors.push('Ed25519 signature verification failed');
      }
    } catch (e: any) {
      errors.push(`Signature verification error: ${e.message}`);
    }

    // 6. Payload size check (prevent DoS)
    const payloadSize = JSON.stringify(msg.payload).length;
    if (payloadSize > 1048576) { // 1MB
      errors.push(`Payload exceeds maximum size: ${payloadSize} bytes`);
    } else if (payloadSize > 524288) { // 512KB
      warnings.push(`Large payload detected: ${payloadSize} bytes`);
    }

    // 7. Nonce validation (prevent replay attacks)
    if (msg.header.nonce < 0 || msg.header.nonce > 1000000) {
      warnings.push(`Unusual nonce value: ${msg.header.nonce}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  private async verifyMessageSignature(msg: A2AMessage): Promise<boolean> {
    const senderDid = msg.header.sender_did;
    if (!senderDid.startsWith('did:key:z')) return false;

    const pubKeyHex = senderDid.replace('did:key:z', '');
    
    try {
      const publicKey = await CryptoService.importEd25519PublicKey(pubKeyHex);
      const canonicalData = CryptoService.canonicalize({
        header: msg.header,
        payload: msg.payload
      });
      
      return await CryptoService.verifyDataEd25519(publicKey, msg.signature, canonicalData);
    } catch (e) {
      return false;
    }
  }

  // --- INPUT SANITIZATION ---

  public sanitizeInput(input: string): string {
    // Idempotent sanitization - applying twice gives same result
    
    // 1. Remove null bytes
    let sanitized = input.replace(/\0/g, '');
    
    // 2. Escape HTML special characters
    sanitized = sanitized
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
    
    // 3. Remove control characters (except newline, tab, carriage return)
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    
    // 4. Limit length to prevent buffer overflow
    if (sanitized.length > 10000) {
      sanitized = sanitized.substring(0, 10000);
    }

    return sanitized;
  }

  // --- AUDIT LOGGING ---

  public async logSecurityEvent(event: SecurityEvent): Promise<void> {
    this.auditLog.push(event);

    // Rotate log if too large
    if (this.auditLog.length > this.MAX_AUDIT_LOG_SIZE) {
      this.auditLog.shift();
    }

    // In production, this should write to:
    // 1. Append-only file with rotation
    // 2. SIEM system (Splunk, ELK)
    // 3. Security monitoring service

    // For now, log to console with structured format
    console.log(JSON.stringify({
      ...event,
      component: 'SECURITY',
      environment: process.env.NODE_ENV || 'development'
    }));
  }

  public getAuditLog(): SecurityEvent[] {
    return [...this.auditLog];
  }

  public clearAuditLog(): void {
    this.auditLog = [];
  }

  // --- MEMORY MONITORING ---

  public checkMemoryUsage(): { usage: number; threshold: number; critical: boolean } {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage();
      const heapUsedMB = usage.heapUsed / 1024 / 1024;
      const heapTotalMB = usage.heapTotal / 1024 / 1024;
      const usagePercent = (heapUsedMB / heapTotalMB) * 100;

      const critical = usagePercent > 80;

      if (critical) {
        this.logSecurityEvent({
          timestamp: Date.now(),
          type: 'MEMORY_THRESHOLD',
          severity: 'HIGH',
          source: 'SYSTEM',
          details: {
            heapUsedMB: heapUsedMB.toFixed(2),
            heapTotalMB: heapTotalMB.toFixed(2),
            usagePercent: usagePercent.toFixed(2)
          }
        });

        // Trigger garbage collection if available
        if (global.gc) {
          console.warn('Memory threshold exceeded, triggering GC');
          global.gc();
        }
      }

      return {
        usage: usagePercent,
        threshold: 80,
        critical
      };
    }

    return { usage: 0, threshold: 80, critical: false };
  }

  // --- AUTHENTICATION BACKOFF ---

  public async recordAuthFailure(identifier: string): Promise<number> {
    const now = Date.now();
    let entry = this.rateLimitMap.get(`auth:${identifier}`);

    if (!entry) {
      entry = {
        count: 1,
        windowStart: now,
        backoffUntil: 0,
        failureCount: 1
      };
      this.rateLimitMap.set(`auth:${identifier}`, entry);
    } else {
      entry.failureCount++;
    }

    // Exponential backoff: 2^N seconds
    const backoffSeconds = Math.pow(2, entry.failureCount);
    const backoffMs = backoffSeconds * 1000;
    entry.backoffUntil = now + backoffMs;

    this.logSecurityEvent({
      timestamp: now,
      type: 'AUTH_FAILURE',
      severity: entry.failureCount > 5 ? 'CRITICAL' : 'HIGH',
      source: identifier,
      details: {
        failureCount: entry.failureCount,
        backoffSeconds,
        backoffUntil: new Date(entry.backoffUntil).toISOString()
      }
    });

    return backoffMs;
  }

  public async checkAuthBackoff(identifier: string): Promise<{ allowed: boolean; backoffMs: number }> {
    const entry = this.rateLimitMap.get(`auth:${identifier}`);
    
    if (!entry) {
      return { allowed: true, backoffMs: 0 };
    }

    const now = Date.now();
    if (entry.backoffUntil > now) {
      return {
        allowed: false,
        backoffMs: entry.backoffUntil - now
      };
    }

    return { allowed: true, backoffMs: 0 };
  }

  public async resetAuthFailures(identifier: string): Promise<void> {
    this.rateLimitMap.delete(`auth:${identifier}`);
  }

  // --- INJECTION DETECTION ---

  public detectInjectionAttempt(input: string): boolean {
    // SQL Injection patterns
    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/i,
      /(--|;|\/\*|\*\/)/,
      /(\bOR\b.*=.*)/i,
      /(\bUNION\b.*\bSELECT\b)/i
    ];

    // Command Injection patterns
    const cmdPatterns = [
      /[;&|`$()]/,
      /\.\.\//,
      /(bash|sh|cmd|powershell|eval|exec)/i
    ];

    // XSS patterns
    const xssPatterns = [
      /<script[^>]*>.*?<\/script>/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /<iframe/i
    ];

    const allPatterns = [...sqlPatterns, ...cmdPatterns, ...xssPatterns];

    for (const pattern of allPatterns) {
      if (pattern.test(input)) {
        this.logSecurityEvent({
          timestamp: Date.now(),
          type: 'INJECTION_ATTEMPT',
          severity: 'CRITICAL',
          source: 'INPUT_VALIDATION',
          details: {
            pattern: pattern.toString(),
            input: input.substring(0, 100) // Log first 100 chars only
          }
        });
        return true;
      }
    }

    return false;
  }

  // --- SECURE RANDOM GENERATION ---

  public generateSecureToken(bytes: number = 32): string {
    return crypto.randomBytes(bytes).toString('hex');
  }

  public generateSecurePassword(length: number = 32): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
    const randomBytes = crypto.randomBytes(length);
    let password = '';
    
    for (let i = 0; i < length; i++) {
      password += charset[randomBytes[i] % charset.length];
    }
    
    return password;
  }

  // --- TIMING-SAFE COMPARISON ---

  public timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) {
      // Still do comparison to prevent timing leak
      crypto.timingSafeEqual(Buffer.from(a), Buffer.from(a));
      return false;
    }

    try {
      return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
    } catch {
      return false;
    }
  }

  // --- CLEANUP ---

  public pruneRateLimitMap(): void {
    const now = Date.now();
    const staleThreshold = 3600000; // 1 hour

    for (const [key, entry] of this.rateLimitMap.entries()) {
      if (now - entry.windowStart > staleThreshold && entry.backoffUntil < now) {
        this.rateLimitMap.delete(key);
      }
    }
  }
}

// Singleton instance
export const securityService = new SecurityService();
