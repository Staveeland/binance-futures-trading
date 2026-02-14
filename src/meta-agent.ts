import { Vote, Signal } from './agents/base-agent.js';

export interface TradeDecision {
  action: Signal;
  symbol: string;
  confidence: number;
  positionSizePercent: number; // % of available capital
  votes: Vote[];
  reasoning: string;
  timestamp: number;
}

export interface VoteSummary {
  long: { count: number; weightedCount: number; avgConfidence: number };
  short: { count: number; weightedCount: number; avgConfidence: number };
  hold: { count: number; weightedCount: number; avgConfidence: number };
}

export class MetaAgent {
  private minConsensus: number = 0.3; // 30% agreement needed (3/10 agents)
  private highConvictionThreshold: number = 0.6; // 60% for large position

  aggregateVotes(votes: Vote[], agentWeights: Map<string, number>): TradeDecision {
    const summary: VoteSummary = {
      long: { count: 0, weightedCount: 0, avgConfidence: 0 },
      short: { count: 0, weightedCount: 0, avgConfidence: 0 },
      hold: { count: 0, weightedCount: 0, avgConfidence: 0 },
    };

    const symbol = votes[0]?.symbol || 'UNKNOWN';
    let totalWeight = 0;

    // Tally votes with weights
    for (const vote of votes) {
      const weight = agentWeights.get(vote.agent) || 1.0;
      totalWeight += weight;

      const bucket = summary[vote.signal.toLowerCase() as 'long' | 'short' | 'hold'];
      bucket.count++;
      bucket.weightedCount += weight;
      bucket.avgConfidence += vote.confidence * weight;
    }

    // Calculate weighted averages
    for (const signal of ['long', 'short', 'hold'] as const) {
      if (summary[signal].weightedCount > 0) {
        summary[signal].avgConfidence /= summary[signal].weightedCount;
      }
    }

    // Find winning signal
    const longRatio = summary.long.weightedCount / totalWeight;
    const shortRatio = summary.short.weightedCount / totalWeight;
    const holdRatio = summary.hold.weightedCount / totalWeight;

    let action: Signal = 'HOLD';
    let winningRatio = holdRatio;
    let avgConfidence = summary.hold.avgConfidence;

    // Plurality wins: if LONG or SHORT has more votes than the other AND meets minimum threshold
    // No longer requires beating HOLD — just needs to be the dominant directional signal
    if (longRatio >= this.minConsensus && longRatio > shortRatio) {
      action = 'LONG';
      winningRatio = longRatio;
      avgConfidence = summary.long.avgConfidence;
    } else if (shortRatio >= this.minConsensus && shortRatio > longRatio) {
      action = 'SHORT';
      winningRatio = shortRatio;
      avgConfidence = summary.short.avgConfidence;
    }

    // Calculate position size based on conviction
    // For futures we use smaller positions due to leverage
    let positionSizePercent = 0;
    if (action !== 'HOLD') {
      if (winningRatio >= this.highConvictionThreshold) {
        positionSizePercent = 15; // High conviction = 15% margin
      } else if (winningRatio >= 0.5) {
        positionSizePercent = 10; // Medium = 10%
      } else {
        positionSizePercent = 5; // Just above threshold = 5%
      }
      // Adjust by confidence
      positionSizePercent *= (avgConfidence / 100);
    }

    // Build reasoning
    const reasoning = this.buildReasoning(votes, summary, action, winningRatio);

    return {
      action,
      symbol,
      confidence: avgConfidence,
      positionSizePercent: Math.round(positionSizePercent * 10) / 10,
      votes,
      reasoning,
      timestamp: Date.now(),
    };
  }

  private buildReasoning(votes: Vote[], summary: VoteSummary, action: Signal, ratio: number): string {
    const lines: string[] = [];
    
    lines.push(`📊 VOTE SUMMARY: LONG ${summary.long.count}/10 | SHORT ${summary.short.count}/10 | HOLD ${summary.hold.count}/10`);
    lines.push(`📈 WEIGHTED CONSENSUS: ${(ratio * 100).toFixed(0)}% ${action}`);
    lines.push('');
    lines.push('🗳️ AGENT VOTES:');
    
    for (const vote of votes) {
      const emoji = vote.signal === 'LONG' ? '🟢' : vote.signal === 'SHORT' ? '🔴' : '⚪';
      lines.push(`${emoji} ${vote.agent}: ${vote.signal} (${vote.confidence}%) - ${vote.reasoning}`);
    }

    return lines.join('\n');
  }

  // Analyze if we should override for risk management
  checkRiskOverride(decision: TradeDecision, currentExposure: number, walletBalance: number): TradeDecision {
    // If we have large exposure and getting mixed signals, reduce
    const exposurePercent = (currentExposure / walletBalance) * 100;
    
    if (exposurePercent > 50 && decision.action === 'HOLD') {
      // Large exposure + uncertainty = close position
      return {
        ...decision,
        action: 'HOLD', // Don't automatically close, just warn
        reasoning: decision.reasoning + '\n\n⚠️ RISK WARNING: High exposure (>50%) with uncertain signals. Consider reducing positions manually.',
      };
    }

    return decision;
  }
}
