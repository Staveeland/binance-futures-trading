import { BaseAgent, MarketData, Vote } from './base-agent.js';

export class DeltaWhale extends BaseAgent {
  private avgVolume: number = 0;

  constructor() {
    super(
      'Delta',
      'Whale Tracker',
      'Follows the big money. High volume = smart money moving.'
    );
  }

  async analyze(data: MarketData): Promise<Vote> {
    const { volume24h, priceChangePercent24h, prices } = data;
    
    // Track average volume (simple rolling update)
    if (this.avgVolume === 0) {
      this.avgVolume = volume24h;
    } else {
      this.avgVolume = this.avgVolume * 0.9 + volume24h * 0.1;
    }

    const volumeRatio = volume24h / this.avgVolume;

    // Whale accumulation: high volume + price up = big buyers
    if (volumeRatio > 1.5 && priceChangePercent24h > 2) {
      return this.createVote(
        'LONG',
        Math.min(90, 50 + volumeRatio * 10 + priceChangePercent24h * 3),
        `Whale accumulation! Volume ${volumeRatio.toFixed(1)}x average, price +${priceChangePercent24h.toFixed(1)}%`,
        data.symbol
      );
    }

    // Whale distribution: high volume + price down = big sellers
    if (volumeRatio > 1.5 && priceChangePercent24h < -2) {
      return this.createVote(
        'SHORT',
        Math.min(90, 50 + volumeRatio * 10 + Math.abs(priceChangePercent24h) * 3),
        `Whale distribution! Volume ${volumeRatio.toFixed(1)}x average, price ${priceChangePercent24h.toFixed(1)}%`,
        data.symbol
      );
    }

    // Unusual volume without clear direction - something brewing
    if (volumeRatio > 2 && Math.abs(priceChangePercent24h) < 1) {
      return this.createVote(
        'HOLD',
        60,
        `Unusual volume (${volumeRatio.toFixed(1)}x) but no direction yet. Watching closely.`,
        data.symbol
      );
    }

    // Low volume = no whale interest
    if (volumeRatio < 0.7) {
      return this.createVote('HOLD', 20, `Low volume (${volumeRatio.toFixed(1)}x avg). No whale activity.`, data.symbol);
    }

    return this.createVote('HOLD', 30, 'Normal volume, no clear whale signal', data.symbol);
  }
}
