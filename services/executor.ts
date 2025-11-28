import { AuditReport, DNSRecord, SecurityPosture } from '../types';
import { CryptoService } from './crypto';

// PROTOGEN-01 EXECUTOR MODULE
// Performs Deep Infrastructure Audits using DNS-over-HTTPS (DoH).
// Bypasses local resolver limits and CORS issues via Google Public DNS JSON API.

const DOH_API = "https://dns.google/resolve";

export class ExecutorService {

  /**
   * Performs a comprehensive infrastructure audit on the target hostname.
   */
  public async performDeepAudit(target: string): Promise<AuditReport> {
    const cleanTarget = target.replace(/https?:\/\//, '').split('/')[0];
    
    // Parallel Execution of DNS Lookups
    const [aRecords, aaaaRecords, mxRecords, txtRecords, caaRecords] = await Promise.all([
      this.resolveDNS(cleanTarget, 'A'),
      this.resolveDNS(cleanTarget, 'AAAA'),
      this.resolveDNS(cleanTarget, 'MX'),
      this.resolveDNS(cleanTarget, 'TXT'),
      this.resolveDNS(cleanTarget, 'CAA'),
    ]);

    // Security Posture Analysis
    const posture = this.analyzeSecurityPosture(txtRecords, aRecords, caaRecords);

    const report: AuditReport = {
      target: cleanTarget,
      timestamp: new Date().toISOString(),
      records: {
        A: aRecords,
        AAAA: aaaaRecords,
        MX: mxRecords,
        TXT: txtRecords
      },
      posture,
      rawResponseHash: ''
    };

    // Calculate Hash of the raw data for integrity
    report.rawResponseHash = await this.hashData(JSON.stringify({
        A: aRecords,
        AAAA: aaaaRecords,
        MX: mxRecords,
        TXT: txtRecords,
        CAA: caaRecords
    }));

    return report;
  }

  private async resolveDNS(name: string, type: 'A' | 'AAAA' | 'MX' | 'TXT' | 'CAA'): Promise<DNSRecord[]> {
    try {
      const url = `${DOH_API}?name=${name}&type=${type}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`DNS Query Failed: ${res.status}`);
      
      const json = await res.json();
      
      if (!json.Answer) return [];

      return json.Answer.map((rec: any) => ({
        name: rec.name,
        type: rec.type,
        TTL: rec.TTL,
        data: rec.data
      }));
    } catch (e) {
      console.warn(`Executor: DNS Resolution failed for ${name} [${type}]`, e);
      return [];
    }
  }

  private analyzeSecurityPosture(txt: DNSRecord[], a: DNSRecord[], caa: DNSRecord[]): SecurityPosture {
    const txtData = txt.map(r => r.data.replace(/^"|"$/g, ''));
    
    const hasSPF = txtData.some(d => d.includes("v=spf1"));
    const hasDMARC = txtData.some(d => d.includes("v=DMARC1"));
    const hasCAA = caa.length > 0;
    const hasDNSSEC = false; // Requires AD bit parsing
    
    // Risk Calculation (Simple Heuristic)
    let risk = 60; // Base
    if (hasSPF) risk -= 15;
    if (hasDMARC) risk -= 15;
    if (hasCAA) risk -= 20; // CAA is strong security signal
    if (a.length === 0) risk += 40; // Broken host

    return {
      hasDNSSEC,
      hasSPF,
      hasDMARC,
      hasCAA,
      riskScore: Math.max(0, Math.min(100, risk))
    };
  }

  private async hashData(input: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return '0x' + Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
}

export const executorService = new ExecutorService();