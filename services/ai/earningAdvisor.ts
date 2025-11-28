/**
 * Earning Advisor - AI-Powered Task Selection Engine
 * 
 * Production-grade LLM integration for autonomous economic decision making.
 * Uses OpenRouter API for multi-model reasoning with deterministic fallback.
 * 
 * Features:
 * - Multi-task selection with risk/reward optimization
 * - Unknown requester risk analysis
 * - Velocity optimization for task throughput
 * - JSON-structured responses with validation
 * - Deterministic fallback when LLM unavailable
 * - Comprehensive error handling
 * 
 * @module services/ai/earningAdvisor
 */

import { Task as MarketplaceTask, TaskEvaluation } from '../survival/taskMarketplace';
import { RiskScore } from '../survival/riskAssessment';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1';
const DEFAULT_MODEL = 'google/gemini-2.0-flash-thinking-exp:free';
const TEMPERATURE = 0.3; // Low temperature for consistent decision making

export interface TaskDecision {
  taskId: string;
  reasoning: string;
  confidence: number;
}

export interface RiskRewardAnalysis {
  recommendation: 'ACCEPT' | 'REJECT' | 'NEGOTIATE';
  reasoning: string;
  expectedValue: number;
}

export interface TaskOption {
  task: MarketplaceTask;
  evaluation: TaskEvaluation;
  riskScore: RiskScore;
}

export class EarningAdvisor {
  private readonly model: string;
  private readonly temperature: number;

  constructor() {
    this.model = process.env.EARNING_ADVISOR_MODEL || DEFAULT_MODEL;
    this.temperature = parseFloat(process.env.EARNING_ADVISOR_TEMPERATURE || String(TEMPERATURE));

    console.log(`[EarningAdvisor] Initialized with model: ${this.model}, temperature: ${this.temperature}`);
  }

  /**
   * Select best task from multiple profitable options using LLM reasoning
   * Requirement 7.1: Consult LLM when multiple profitable tasks available
   * Requirement 7.2: Provide balance, task details, and risk scores in prompt
   * Requirement 7.3: Parse JSON response with task selection and reasoning
   */
  public async selectBestTask(
    tasks: TaskOption[],
    currentBalance: number
  ): Promise<TaskDecision> {
    console.log(`[EarningAdvisor] Selecting best task from ${tasks.length} options`);
    console.log(`[EarningAdvisor] Current balance: ${currentBalance.toFixed(4)} USDC`);

    // If only one task, return it immediately
    if (tasks.length === 1) {
      return {
        taskId: tasks[0].task.task_id,
        reasoning: 'Only one task available',
        confidence: 1.0
      };
    }

    try {
      // Construct prompt with task details
      const prompt = this.buildTaskSelectionPrompt(tasks, currentBalance);

      // Query LLM
      const response = await this.queryLLM(prompt, 'task_selection');

      // Parse and validate response
      const decision = this.parseTaskDecision(response, tasks);

      console.log(`[EarningAdvisor] Selected task: ${decision.taskId}`);
      console.log(`[EarningAdvisor] Reasoning: ${decision.reasoning}`);
      console.log(`[EarningAdvisor] Confidence: ${(decision.confidence * 100).toFixed(1)}%`);

      return decision;

    } catch (error: any) {
      console.error(`[EarningAdvisor] LLM selection failed:`, error.message);
      console.log(`[EarningAdvisor] Falling back to deterministic selection`);

      // Fallback to deterministic selection
      return this.deterministicTaskSelection(tasks);
    }
  }

  /**
   * Analyze risk/reward for unknown requester with above-market payment
   * Requirement 7.4: Consult LLM for risk/reward analysis
   */
  public async analyzeRiskReward(
    task: MarketplaceTask,
    evaluation: TaskEvaluation,
    riskScore: RiskScore
  ): Promise<RiskRewardAnalysis> {
    console.log(`[EarningAdvisor] Analyzing risk/reward for task: ${task.task_id}`);
    console.log(`[EarningAdvisor] Payment: ${task.payment.amount} USDC, Risk: ${riskScore.overall}/100`);

    try {
      // Construct prompt with risk/reward details
      const prompt = this.buildRiskRewardPrompt(task, evaluation, riskScore);

      // Query LLM
      const response = await this.queryLLM(prompt, 'risk_reward');

      // Parse and validate response
      const analysis = this.parseRiskRewardAnalysis(response, evaluation);

      console.log(`[EarningAdvisor] Recommendation: ${analysis.recommendation}`);
      console.log(`[EarningAdvisor] Expected value: ${analysis.expectedValue.toFixed(4)} USDC`);
      console.log(`[EarningAdvisor] Reasoning: ${analysis.reasoning}`);

      return analysis;

    } catch (error: any) {
      console.error(`[EarningAdvisor] LLM analysis failed:`, error.message);
      console.log(`[EarningAdvisor] Falling back to deterministic analysis`);

      // Fallback to deterministic analysis
      return this.deterministicRiskReward(evaluation, riskScore);
    }
  }

  /**
   * Build prompt for task selection
   */
  private buildTaskSelectionPrompt(tasks: TaskOption[], currentBalance: number): string {
    const taskSummaries = tasks.map((opt, idx) => {
      return `Task ${idx + 1}:
- ID: ${opt.task.task_id}
- Type: ${opt.task.type}
- Payment: ${opt.task.payment.amount} USDC
- Estimated Profit: ${opt.evaluation.estimatedProfit.toFixed(4)} USDC
- Estimated Duration: ${(opt.evaluation.estimatedDuration / 1000 / 60).toFixed(1)} minutes
- Risk Score: ${opt.riskScore.overall}/100 (trust: ${opt.riskScore.factors.requester_trust}, payload: ${opt.riskScore.factors.payload_safety}, payment: ${opt.riskScore.factors.payment_security})
- Requester: ${opt.task.requester_did.substring(0, 24)}...
- Description: ${opt.task.description}`;
    }).join('\n\n');

    return `You are an autonomous agent's economic advisor. Select the optimal task to maximize long-term economic viability.

Current Balance: ${currentBalance.toFixed(4)} USDC

Available Tasks:
${taskSummaries}

Consider:
1. Profit per minute (velocity optimization)
2. Risk-adjusted expected value
3. Balance runway after execution
4. Requester reputation signals

Respond with JSON only (no markdown):
{
  "taskId": "selected_task_id",
  "reasoning": "brief explanation of selection criteria",
  "confidence": 0.0-1.0
}`;
  }

  /**
   * Build prompt for risk/reward analysis
   */
  private buildRiskRewardPrompt(
    task: MarketplaceTask,
    evaluation: TaskEvaluation,
    riskScore: RiskScore
  ): string {
    return `You are an autonomous agent's risk advisor. Analyze this task offer from an unknown requester.

Task Details:
- Payment: ${task.payment.amount} USDC
- Estimated Cost: ${evaluation.estimatedCost.toFixed(4)} USDC
- Estimated Profit: ${evaluation.estimatedProfit.toFixed(4)} USDC
- Duration: ${(evaluation.estimatedDuration / 1000 / 60).toFixed(1)} minutes
- Type: ${task.type}
- Description: ${task.description}

Risk Assessment:
- Overall Risk: ${riskScore.overall}/100
- Requester Trust: ${riskScore.factors.requester_trust}/100 (unknown requester)
- Payload Safety: ${riskScore.factors.payload_safety}/100
- Payment Security: ${riskScore.factors.payment_security}/100

The payment is above market rate, but the requester is unknown. Consider:
1. Probability of payment default
2. Probability of malicious payload
3. Expected value = (profit × success_probability) - (cost × failure_probability)
4. Opportunity cost of time

Respond with JSON only (no markdown):
{
  "recommendation": "ACCEPT" | "REJECT" | "NEGOTIATE",
  "reasoning": "brief risk/reward analysis",
  "expectedValue": estimated_expected_value_in_usdc
}`;
  }

  /**
   * Query LLM via OpenRouter API
   */
  private async queryLLM(prompt: string, context: string): Promise<string> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('OpenRouter API key not configured');
    }

    console.log(`[EarningAdvisor] Querying LLM for ${context}...`);

    const response = await fetch(`${OPENROUTER_API_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://github.com/DelovoyMotiv/PROTOGEN',
        'X-Title': 'PROTOGEN-01 Earning Advisor'
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are an economic advisor for an autonomous agent. Respond with valid JSON only. No markdown formatting.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: this.temperature,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    
    if (!data.choices || data.choices.length === 0) {
      throw new Error('No response from LLM');
    }

    const content = data.choices[0].message.content;
    console.log(`[EarningAdvisor] LLM response received (${content.length} chars)`);

    return content;
  }

  /**
   * Parse task decision from LLM response
   */
  private parseTaskDecision(response: string, tasks: TaskOption[]): TaskDecision {
    // Remove markdown code blocks if present
    let cleaned = response.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    }

    const parsed = JSON.parse(cleaned);

    // Validate structure
    if (!parsed.taskId || !parsed.reasoning || typeof parsed.confidence !== 'number') {
      throw new Error('Invalid task decision structure');
    }

    // Validate taskId exists
    const taskExists = tasks.some(opt => opt.task.task_id === parsed.taskId);
    if (!taskExists) {
      throw new Error(`Selected task ID ${parsed.taskId} not in available tasks`);
    }

    return {
      taskId: parsed.taskId,
      reasoning: parsed.reasoning,
      confidence: Math.max(0, Math.min(1, parsed.confidence))
    };
  }

  /**
   * Parse risk/reward analysis from LLM response
   */
  private parseRiskRewardAnalysis(response: string, evaluation: TaskEvaluation): RiskRewardAnalysis {
    // Remove markdown code blocks if present
    let cleaned = response.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    }

    const parsed = JSON.parse(cleaned);

    // Validate structure
    if (!parsed.recommendation || !parsed.reasoning || typeof parsed.expectedValue !== 'number') {
      throw new Error('Invalid risk/reward analysis structure');
    }

    // Validate recommendation
    if (!['ACCEPT', 'REJECT', 'NEGOTIATE'].includes(parsed.recommendation)) {
      throw new Error(`Invalid recommendation: ${parsed.recommendation}`);
    }

    return {
      recommendation: parsed.recommendation,
      reasoning: parsed.reasoning,
      expectedValue: parsed.expectedValue
    };
  }

  /**
   * Deterministic task selection fallback
   * Requirement 7.5: Velocity optimization
   */
  private deterministicTaskSelection(tasks: TaskOption[]): TaskDecision {
    // Calculate profit per minute for each task
    const scored = tasks.map(opt => {
      const profitPerMinute = opt.evaluation.estimatedProfit / (opt.evaluation.estimatedDuration / 1000 / 60);
      const riskPenalty = opt.riskScore.overall / 100;
      const score = profitPerMinute * (1 - riskPenalty);

      return { task: opt.task, score, profitPerMinute };
    });

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    const best = scored[0];

    return {
      taskId: best.task.task_id,
      reasoning: `Deterministic selection: highest profit velocity (${best.profitPerMinute.toFixed(4)} USDC/min) with risk adjustment`,
      confidence: 0.8
    };
  }

  /**
   * Deterministic risk/reward analysis fallback
   */
  private deterministicRiskReward(evaluation: TaskEvaluation, riskScore: RiskScore): RiskRewardAnalysis {
    // Simple expected value calculation
    const successProbability = 1 - (riskScore.overall / 100);
    const failureProbability = riskScore.overall / 100;
    
    const expectedValue = (evaluation.estimatedProfit * successProbability) - (evaluation.estimatedCost * failureProbability);

    let recommendation: 'ACCEPT' | 'REJECT' | 'NEGOTIATE';
    let reasoning: string;

    if (riskScore.overall > 70) {
      recommendation = 'REJECT';
      reasoning = 'Risk too high (>70/100) for unknown requester';
    } else if (expectedValue < 0) {
      recommendation = 'REJECT';
      reasoning = `Negative expected value: ${expectedValue.toFixed(4)} USDC`;
    } else if (riskScore.overall > 50) {
      recommendation = 'NEGOTIATE';
      reasoning = `Moderate risk (${riskScore.overall}/100), seek better terms`;
    } else {
      recommendation = 'ACCEPT';
      reasoning = `Positive expected value: ${expectedValue.toFixed(4)} USDC with acceptable risk`;
    }

    return {
      recommendation,
      reasoning,
      expectedValue
    };
  }

  /**
   * Get OpenRouter API key
   */
  private getApiKey(): string | null {
    // Check environment variable
    if (process.env.VITE_OPENROUTER_API_KEY) {
      return process.env.VITE_OPENROUTER_API_KEY;
    }

    // Check localStorage (browser environment)
    if (typeof window !== 'undefined') {
      const key = localStorage.getItem('protogen_or_key');
      return key && key.trim().length > 0 ? key : null;
    }

    return null;
  }

  /**
   * Check if LLM is available
   */
  public isAvailable(): boolean {
    return this.getApiKey() !== null;
  }
}
