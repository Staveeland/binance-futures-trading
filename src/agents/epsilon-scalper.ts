import { BaseAgent, MarketData, Vote } from './base-agent.js';

export class EpsilonScalper extends BaseAgent {
  private lastPrice: number = 0;
  private lastSignal: 'LONG' | 'SHORT' | null = null;

  constructor() {
    super(
      'Epsilon',
      'Scalper',
      'Quick in-and-out trades on small moves. Death by a thousand cuts (for the market).'
    );
  }

  async analyze(data: MarketData): Promise<Vote> {
    const { price, prices, priceChangePercent24h } = data;
    
    // Calculate micro-movements
    const recentPrices = prices.slice(-3);
    let microTrend = 0;
    if (recentPrices.length >= 2) {
      microTrend = ((recentPrices[recentPrices.length - 1] - recentPrices[0]) / recentPrices[0]) * 100;
    }

    // Calculate volatility for scalping opportunity
    const volatility = prices.length >= 2 
      ? Math.abs(Math.max(...prices) - Math.min(...prices)) / price * 100 
      : 0;

    // Good scalping conditions: enough volatility, not too crazy
    const goodForScalping = volatility > 0.5 && volatility < 5;

    if (!goodForScalping) {
      return this.createVote(
        'HOLD',
        20,
        volatility < 0.5 ? 'Too quiet for scalping' : 'Too volatile, risky for scalping',
        data.symbol
      );
    }

    // Quick reversal play: micro-dip in uptrend
    if (microTrend < -0.3 && priceChangePercent24h > 1) {
      this.lastSignal = 'LONG';
      return this.createVote(
        'LONG',
        55,
        `Micro-dip (${microTrend.toFixed(2)}%) in uptrend. Quick bounce play.`,
        data.symbol
      );
    }

    // Quick reversal play: micro-pump in downtrend
    if (microTrend > 0.3 && priceChangePercent24h < -1) {
      this.lastSignal = 'SHORT';
      return this.createVote(
        'SHORT',
        55,
        `Micro-pump (${microTrend.toFixed(2)}%) in downtrend. Fade it.`,
        data.symbol
      );
    }

    // Ride micro-momentum
    if (microTrend > 0.5) {
      return this.createVote('LONG', 45, `Micro-momentum up ${microTrend.toFixed(2)}%`, data.symbol);
    }
    if (microTrend < -0.5) {
      return this.createVote('SHORT', 45, `Micro-momentum down ${microTrend.toFixed(2)}%`, data.symbol);
    }

    return this.createVote('HOLD', 30, 'No scalp setup', data.symbol);
  }
}
