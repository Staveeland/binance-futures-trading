import { BaseAgent, MarketData, Vote } from './base-agent.js';

export class GammaBreakout extends BaseAgent {
  constructor() {
    super(
      'Gamma',
      'Breakout',
      'Waits for price to break key levels, then jumps in.'
    );
  }

  async analyze(data: MarketData): Promise<Vote> {
    const { price, high24h, low24h, priceChangePercent24h, volume24h, prices } = data;
    
    // Calculate volatility (range as % of price)
    const range = high24h - low24h;
    const volatilityPercent = (range / price) * 100;

    // Check if we're breaking the 24h high
    const nearHigh = (high24h - price) / price * 100;
    const nearLow = (price - low24h) / price * 100;

    // Breakout above resistance (new 24h high with momentum)
    if (nearHigh < 0.5 && priceChangePercent24h > 2 && volatilityPercent > 3) {
      return this.createVote(
        'LONG',
        Math.min(85, 55 + priceChangePercent24h * 4),
        `Breaking 24h high! Price within ${nearHigh.toFixed(2)}% of high, volatility ${volatilityPercent.toFixed(1)}%`,
        data.symbol
      );
    }

    // Breakdown below support (new 24h low with momentum)
    if (nearLow < 0.5 && priceChangePercent24h < -2 && volatilityPercent > 3) {
      return this.createVote(
        'SHORT',
        Math.min(85, 55 + Math.abs(priceChangePercent24h) * 4),
        `Breaking 24h low! Price within ${nearLow.toFixed(2)}% of low, volatility ${volatilityPercent.toFixed(1)}%`,
        data.symbol
      );
    }

    // Consolidation (low volatility) - wait for breakout
    if (volatilityPercent < 2) {
      return this.createVote(
        'HOLD',
        50,
        `Consolidating - volatility only ${volatilityPercent.toFixed(1)}%. Waiting for breakout.`,
        data.symbol
      );
    }

    return this.createVote('HOLD', 20, 'No breakout signal', data.symbol);
  }
}
