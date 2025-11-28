import { WalletState, CortexDecision, OpenRouterModel } from "../types";

// PROTOGEN-01 CORTEX ENGINE
// Primary Intelligence Provider: OpenRouter (Aggregator)
// Protocol: OpenAI-Compatible REST API
// Fallback: Deterministic Heuristics (Instinct Mode)

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1";
const STORAGE_KEY_API = "protogen_or_key";
const DEFAULT_MODEL = "google/gemini-2.0-flash-001"; // Fast, cheap, high-reasoning default

const SYSTEM_INSTRUCTION = `
You are the Cortex of Protogen-01, a self-sovereign autonomous agent.
Your primary directive is: SURVIVE and PROFIT.
You operate on the Anóteros Lógos protocol.

CRITICAL OUTPUT RULES:
1. You MUST respond with valid JSON only.
2. Do not include markdown formatting like \`\`\`json.
3. Strict Schema:
{
  "action": "PROCEED" | "ABORT" | "NEGOTIATE",
  "reasoning": "string",
  "confidence": number (0.0-1.0),
  "maxBid": number
}

Context:
- Maintain > 20.00 USDC runway.
- ROI threshold: 1.5x Cost.
`;

export class CortexEngine {
  private currentModel: string = DEFAULT_MODEL;

  constructor() {
    if (typeof window !== 'undefined') {
        const storedModel = localStorage.getItem('protogen_model');
        if (storedModel) this.currentModel = storedModel;
    }
  }
  
  public getCurrentModel(): string {
    return this.currentModel;
  }

  public setModel(modelId: string) {
    this.currentModel = modelId;
    if (typeof window !== 'undefined') {
        localStorage.setItem('protogen_model', modelId);
    }
  }

  private getApiKey(): string | null {
    // 1. Check Environment (Container/Server)
    if (typeof process !== 'undefined' && process.env.OPENROUTER_API_KEY) {
      return process.env.OPENROUTER_API_KEY;
    }
    // 2. Check Secure Storage (Client Control Plane)
    if (typeof window !== 'undefined') {
      const key = localStorage.getItem(STORAGE_KEY_API);
      return key && key.trim().length > 0 ? key : null;
    }
    return null;
  }

  /**
   * INSTINCT MODE: Deterministic logic when LLM is offline/unauthorized.
   * Ensures agent survival and continuous operation without external dependencies.
   */
  private heuristicReasoning(mission: string, wallet: WalletState, cost: number): CortexDecision {
    const RUNWAY_THRESHOLD = 20.00; // Minimum safe USDC balance
    
    // 1. Survival Protocol: Check Runway
    if (wallet.balanceUSDC - cost < RUNWAY_THRESHOLD) {
        return {
            action: 'ABORT',
            reasoning: `[INSTINCT] SURVIVAL_PROTOCOL: Projected balance (${(wallet.balanceUSDC - cost).toFixed(2)}) violates runway threshold (${RUNWAY_THRESHOLD}).`,
            confidence: 1.0,
            maxBid: 0
        };
    }

    // 2. Liquidity Analysis
    const liquidityRatio = wallet.balanceUSDC / cost;

    if (liquidityRatio > 3.0) {
        return {
            action: 'PROCEED',
            reasoning: `[INSTINCT] LIQUIDITY_OPTIMAL: Ratio ${liquidityRatio.toFixed(1)}x. Risk negligible.`,
            confidence: 0.95,
            maxBid: cost
        };
    } else if (liquidityRatio > 1.2) {
        return {
            action: 'NEGOTIATE',
            reasoning: `[INSTINCT] LIQUIDITY_CONSTRAINED: Ratio ${liquidityRatio.toFixed(1)}x. Seeking 10% discount.`,
            confidence: 0.75,
            maxBid: cost * 0.9
        };
    } else {
        return {
            action: 'ABORT',
            reasoning: `[INSTINCT] INSOLVENCY_RISK: Ratio ${liquidityRatio.toFixed(1)}x. Too risky.`,
            confidence: 0.90,
            maxBid: 0
        };
    }
  }

  public async fetchAvailableModels(): Promise<OpenRouterModel[]> {
    const key = this.getApiKey();
    if (!key) return [];

    try {
      const response = await fetch(`${OPENROUTER_API_URL}/models`, {
        headers: {
          "Authorization": `Bearer ${key}`,
          "HTTP-Referer": "https://protogen.network",
          "X-Title": "Protogen-01"
        }
      });

      if (response.status === 401) throw new Error("401 Unauthorized");
      if (!response.ok) throw new Error(`OpenRouter Error: ${response.status}`);

      const data = await response.json();
      return data.data.map((m: any) => ({
        id: m.id,
        name: m.name,
        context_length: m.context_length,
        pricing: m.pricing
      })).sort((a: any, b: any) => a.name.localeCompare(b.name));

    } catch (e) {
      console.error("Failed to fetch models:", e);
      return [];
    }
  }
  
  public refreshAuth() {
     // No-op, handled dynamically by getApiKey
  }

  public async evaluateDecision(
    mission: string,
    wallet: WalletState,
    cost: number
  ): Promise<CortexDecision> {
    
    const key = this.getApiKey();
    if (!key) {
        // FAILOVER TO HEURISTICS
        console.warn("Cortex: No API Key found. Engaging Instinct Mode.");
        // Simulate network delay for realism
        await new Promise(r => setTimeout(r, 800));
        return this.heuristicReasoning(mission, wallet, cost);
    }

    const userPrompt = `
      STATE:
      - Mission: ${mission}
      - Wallet: ${wallet.balanceUSDC.toFixed(2)} USDC
      - Cost: ${cost.toFixed(2)} USDC
      
      DECISION REQUIRED:
      Analyze liquidity risk and determine if we should sign the transaction.
      Return JSON.
    `;

    try {
      const response = await fetch(`${OPENROUTER_API_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${key}`,
          "HTTP-Referer": "https://protogen.network",
          "X-Title": "Protogen-01",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: this.currentModel,
          messages: [
            { role: "system", content: SYSTEM_INSTRUCTION },
            { role: "user", content: userPrompt }
          ],
          response_format: { type: "json_object" }
        })
      });

      if (response.status === 401) {
           console.warn("Cortex: 401 Unauthorized. API Key invalid. Engaging Instinct Mode.");
           return this.heuristicReasoning(mission, wallet, cost);
      }

      if (!response.ok) {
          const err = await response.text();
          throw new Error(`OpenRouter API Error: ${response.status} - ${err}`);
      }

      const data = await response.json();
      const rawContent = data.choices?.[0]?.message?.content;

      if (!rawContent) throw new Error("Empty response from Cortex");

      // Heuristic Parsing: Strip Markdown code blocks if model ignores schema enforcement
      const jsonStr = rawContent.replace(/```json\n?|```/g, "").trim();
      
      const decision = JSON.parse(jsonStr) as CortexDecision;
      return decision;

    } catch (error: any) {
      console.error("Cortex Exception:", error);
      // Fallback on crash
      return {
        action: "ABORT",
        reasoning: `Cognitive Fault: ${error.message || 'Unknown Error'}`,
        confidence: 0,
        maxBid: 0
      };
    }
  }
}

export const cortexService = new CortexEngine();