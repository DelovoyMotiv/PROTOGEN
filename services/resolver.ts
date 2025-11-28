import { AgentCard } from "../types";

// PROTOGEN-01 AID RESOLVER
// Implements strict DNS-based Discovery for Anóteros Lógos Agents.
// Uses Google DNS-over-HTTPS to bypass local DNS caching/filtering.

const DOH_ENDPOINT = "https://dns.google/resolve";

export class AgentResolver {
  
  /**
   * Resolves a domain to an Agent DID via TXT record.
   * Spec: TXT _agent.<domain> IN "v=aid1;did=did:key:z...;api=..."
   */
  public async resolveDID(domain: string): Promise<string | null> {
    try {
      // Construct query for _agent subdomain
      const target = `_agent.${domain}`;
      const url = `${DOH_ENDPOINT}?name=${target}&type=TXT`;

      const response = await fetch(url);
      if (!response.ok) throw new Error(`DoH Error: ${response.status}`);
      
      const data = await response.json();
      
      // Strict DNS response validation
      if (!data.Answer || !Array.isArray(data.Answer)) {
        console.warn(`Resolver: No TXT record found for ${target}`);
        return null;
      }

      for (const record of data.Answer) {
        // TXT data often comes quoted
        const rawData = record.data.replace(/^"|"$/g, '');
        
        if (rawData.startsWith('v=aid1')) {
          const parts = rawData.split(';');
          const didPart = parts.find((p: string) => p.trim().startsWith('did='));
          if (didPart) {
            return didPart.split('=')[1].trim();
          }
        }
      }
      
      return null;

    } catch (e) {
      console.error("Resolver Exception:", e);
      return null;
    }
  }

  /**
   * Fetches the Agent Card from the .well-known path.
   * Spec: GET https://<domain>/.well-known/agent-card.json
   */
  public async fetchAgentCard(domain: string): Promise<AgentCard | null> {
    try {
      const url = `https://${domain}/.well-known/agent-card.json`;
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json'
        },
        mode: 'cors' // Agent Cards must be CORS enabled
      });

      if (!response.ok) {
        console.warn(`Resolver: Failed to fetch Agent Card from ${domain} (${response.status})`);
        return null;
      }

      const card = await response.json();
      
      // Basic Schema Validation
      if (!card.id || !card.payment || !card.communication) {
        console.warn(`Resolver: Invalid Agent Card Schema from ${domain}`);
        return null;
      }

      return card as AgentCard;

    } catch (e) {
      console.error("Resolver Fetch Exception:", e);
      return null;
    }
  }

  /**
   * Full Discovery Flow: Domain -> DID + Card
   */
  public async discoverAgent(domain: string): Promise<{ did: string, card: AgentCard } | null> {
    // 1. Resolve DID via DNS
    const did = await this.resolveDID(domain);
    if (!did) return null;

    // 2. Fetch Card
    const card = await this.fetchAgentCard(domain);
    
    // 3. Integrity Check: The DID in DNS must match the DID in the Card
    if (card && card.id !== did) {
      console.warn(`Resolver: DID Mismatch! DNS: ${did} vs Card: ${card.id}`);
      return null; // Reject spoofed cards
    }

    if (!card) return null;

    return { did, card };
  }
}

export const resolverService = new AgentResolver();