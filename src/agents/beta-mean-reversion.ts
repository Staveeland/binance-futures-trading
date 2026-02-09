import { BaseAgent, MarketData, Vote } from './base-agent.js';

export class BetaMeanReversion extends BaseAgent {
  constructor() {
    super(
      'Beta',
      'Mean Reversion',
      'Buys oversold conditions, sells overbought. Fades extremes.'
    );
  }

  async analyze(data: MarketData): Promise<Vote> {
    const { price, priceChangePercent24h, high24h, low24h, prices } = data;
    
    // Calculate RSI-like metric from price position in range
    const range = high24h - low24h;
    const positionInRange = range > 0 ? (price - low24h) / range * 100 : 50;

    // Calculate simple moving average
    const sma = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : price;
    const deviationFromSMA = ((price - sma) / sma) * 100;

    // Oversold: price near 24h low AND big drop
    if (positionInRange < 20 && priceChangePercent24h < -5) {
      return this.createVote(
        'LONG',
        Math.min(85, 60 + Math.abs(priceChangePercent24h) * 3),
        `Oversold! Position in range: ${positionInRange.toFixed(0)}%, down ${priceChangePercent24h.toFixed(1)}%`,
        data.symbol
      );
    }

    // Overbought: price near 24h high AND big pump
    if (positionInRange > 80 && priceChangePercent24h > 5) {
      return this.createVote(
        'SHORT',
        Math.min(85, 60 + priceChangePercent24h * 3),
        `Overbought! Position in range: ${positionInRange.toFixed(0)}%, up ${priceChangePercent24h.toFixed(1)}%`,
        data.symbol
      );
    }

    // Mild mean reversion signals
    if (deviationFromSMA < -3) {
      return this.createVote('LONG', 45, `Below SMA by ${Math.abs(deviationFromSMA).toFixed(1)}%`, data.symbol);
    }
    if (deviationFromSMA > 3) {
      return this.createVote('SHORT', 45, `Above SMA by ${deviationFromSMA.toFixed(1)}%`, data.symbol);
    }

    return this.createVote('HOLD', 25, 'Price near fair value', data.symbol);
  }
}
