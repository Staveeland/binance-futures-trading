import { BaseAgent, MarketData, Vote } from './base-agent.js';

export class AlphaMomentum extends BaseAgent {
  constructor() {
    super(
      'Alpha',
      'Momentum',
      'Follows trends - buys strength, sells weakness. Rides the wave.'
    );
  }

  async analyze(data: MarketData): Promise<Vote> {
    const { priceChangePercent24h, prices } = data;
    
    // Calculate short-term momentum (last 5 prices)
    const recentPrices = prices.slice(-5);
    const shortMomentum = recentPrices.length >= 2 
      ? (recentPrices[recentPrices.length - 1] - recentPrices[0]) / recentPrices[0] * 100
      : 0;

    // Strong uptrend: both 24h and short-term positive
    if (priceChangePercent24h > 3 && shortMomentum > 1) {
      return this.createVote(
        'LONG',
        Math.min(90, 50 + priceChangePercent24h * 5),
        `Strong momentum: 24h +${priceChangePercent24h.toFixed(1)}%, short-term +${shortMomentum.toFixed(2)}%`,
        data.symbol
      );
    }

    // Strong downtrend: exit
    if (priceChangePercent24h < -3 && shortMomentum < -1) {
      return this.createVote(
        'SHORT',
        Math.min(90, 50 + Math.abs(priceChangePercent24h) * 5),
        `Momentum broken: 24h ${priceChangePercent24h.toFixed(1)}%, short-term ${shortMomentum.toFixed(2)}%`,
        data.symbol
      );
    }

    // Mild trend continuation
    if (priceChangePercent24h > 1.5) {
      return this.createVote('LONG', 40, `Mild uptrend: +${priceChangePercent24h.toFixed(1)}%`, data.symbol);
    }
    if (priceChangePercent24h < -1.5) {
      return this.createVote('SHORT', 40, `Mild downtrend: ${priceChangePercent24h.toFixed(1)}%`, data.symbol);
    }

    return this.createVote('HOLD', 30, 'No clear momentum signal', data.symbol);
  }
}
