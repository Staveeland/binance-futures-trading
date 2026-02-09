import { BaseAgent, MarketData, Vote } from './base-agent.js';

export class ThetaDCA extends BaseAgent {
  private buyHistory: { price: number; timestamp: number }[] = [];
  private lastBuyTime: number = 0;
  private minInterval: number = 30 * 60 * 1000; // 30 minutes between buys

  constructor() {
    super(
      'Theta',
      'DCA',
      'Dollar-cost averaging. Steady accumulation, buying more on dips.'
    );
  }

  async analyze(data: MarketData): Promise<Vote> {
    const { price, priceChangePercent24h } = data;
    const now = Date.now();
    
    // Calculate average buy price
    const avgBuyPrice = this.buyHistory.length > 0
      ? this.buyHistory.reduce((sum, b) => sum + b.price, 0) / this.buyHistory.length
      : price;

    const timeSinceLastBuy = now - this.lastBuyTime;
    const canBuy = timeSinceLastBuy > this.minInterval;

    // Aggressive DCA: buy extra on significant dips
    if (priceChangePercent24h < -7 && canBuy) {
      this.lastBuyTime = now;
      this.buyHistory.push({ price, timestamp: now });
      return this.createVote(
        'LONG',
        80,
        `Flash sale! Down ${priceChangePercent24h.toFixed(1)}%. Aggressive DCA buy.`,
        data.symbol
      );
    }

    // Regular DCA: buy on moderate dips
    if (priceChangePercent24h < -3 && canBuy) {
      this.lastBuyTime = now;
      this.buyHistory.push({ price, timestamp: now });
      return this.createVote(
        'LONG',
        65,
        `Dip detected (${priceChangePercent24h.toFixed(1)}%). DCA buy.`,
        data.symbol
      );
    }

    // Standard interval buy (if it's been long enough and price isn't pumping)
    if (canBuy && priceChangePercent24h < 3) {
      this.lastBuyTime = now;
      this.buyHistory.push({ price, timestamp: now });
      return this.createVote(
        'LONG',
        50,
        `Scheduled DCA buy. Current price vs avg: ${((price / avgBuyPrice - 1) * 100).toFixed(1)}%`,
        data.symbol
      );
    }

    // Don't buy during pumps
    if (priceChangePercent24h > 5) {
      return this.createVote(
        'HOLD',
        55,
        `Pausing DCA - price pumping +${priceChangePercent24h.toFixed(1)}%. Will buy on pullback.`,
        data.symbol
      );
    }

    // Take profits if way above average
    if (price > avgBuyPrice * 1.2 && this.buyHistory.length > 3) {
      return this.createVote(
        'SHORT',
        60,
        `Up ${((price / avgBuyPrice - 1) * 100).toFixed(1)}% from DCA average. Taking some profits.`,
        data.symbol
      );
    }

    return this.createVote('HOLD', 30, `Waiting for next DCA interval (${Math.round((this.minInterval - timeSinceLastBuy) / 60000)}min)`, data.symbol);
  }
}
