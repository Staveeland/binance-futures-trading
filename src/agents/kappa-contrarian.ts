import { BaseAgent, MarketData, Vote } from './base-agent.js';

export class KappaContrarian extends BaseAgent {
  constructor() {
    super(
      'Kappa',
      'Contrarian',
      'Bets against the crowd. When everyone is bullish, sell. When everyone panics, buy.'
    );
  }

  async analyze(data: MarketData): Promise<Vote> {
    const { price, priceChangePercent24h, volume24h, high24h, low24h, prices } = data;
    
    // Calculate how "extended" the move is
    const range = high24h - low24h;
    const positionInRange = range > 0 ? ((price - low24h) / range) * 100 : 50;

    // Count consecutive moves in same direction
    let consecutiveUp = 0;
    let consecutiveDown = 0;
    for (let i = prices.length - 1; i > 0; i--) {
      if (prices[i] > prices[i - 1]) {
        if (consecutiveDown > 0) break;
        consecutiveUp++;
      } else if (prices[i] < prices[i - 1]) {
        if (consecutiveUp > 0) break;
        consecutiveDown++;
      }
    }

    // Extreme bullishness = fade it
    if (priceChangePercent24h > 8 && positionInRange > 90 && consecutiveUp >= 3) {
      return this.createVote(
        'SHORT',
        Math.min(90, 60 + priceChangePercent24h * 2),
        `Extreme greed! +${priceChangePercent24h.toFixed(1)}%, ${consecutiveUp} consecutive ups, position ${positionInRange.toFixed(0)}% in range. FADING.`,
        data.symbol
      );
    }

    // Extreme bearishness = buy the blood
    if (priceChangePercent24h < -8 && positionInRange < 10 && consecutiveDown >= 3) {
      return this.createVote(
        'LONG',
        Math.min(90, 60 + Math.abs(priceChangePercent24h) * 2),
        `Extreme fear! ${priceChangePercent24h.toFixed(1)}%, ${consecutiveDown} consecutive downs, position ${positionInRange.toFixed(0)}% in range. BUYING BLOOD.`,
        data.symbol
      );
    }

    // Moderate contrarian signals
    if (priceChangePercent24h > 5 && positionInRange > 80) {
      return this.createVote('SHORT', 55, `Crowd is bullish (+${priceChangePercent24h.toFixed(1)}%). Slight fade.`, data.symbol);
    }
    if (priceChangePercent24h < -5 && positionInRange < 20) {
      return this.createVote('LONG', 55, `Crowd is panicking (${priceChangePercent24h.toFixed(1)}%). Slight accumulation.`, data.symbol);
    }

    // No extreme sentiment
    return this.createVote(
      'HOLD',
      35,
      `No extreme sentiment to fade. Waiting for crowd to get stupid.`,
      data.symbol
    );
  }
}
