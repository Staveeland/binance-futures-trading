import { BaseAgent, MarketData, Vote } from './base-agent.js';

export class ZetaGrid extends BaseAgent {
  private gridLevels: number[] = [];
  private lastBuyLevel: number = 0;
  private lastSellLevel: number = 0;

  constructor() {
    super(
      'Zeta',
      'Grid Trading',
      'Sets buy/sell orders at fixed intervals. Profits from ranging markets.'
    );
  }

  async analyze(data: MarketData): Promise<Vote> {
    const { price, high24h, low24h } = data;
    
    // Create grid with 5 levels
    const gridSpacing = (high24h - low24h) / 6;
    this.gridLevels = [];
    for (let i = 1; i <= 5; i++) {
      this.gridLevels.push(low24h + gridSpacing * i);
    }

    // Find nearest grid level
    let nearestLevel = this.gridLevels[0];
    let minDistance = Math.abs(price - nearestLevel);
    for (const level of this.gridLevels) {
      const distance = Math.abs(price - level);
      if (distance < minDistance) {
        minDistance = distance;
        nearestLevel = level;
      }
    }

    const distancePercent = (minDistance / price) * 100;
    const levelIndex = this.gridLevels.indexOf(nearestLevel);

    // Price at lower grid levels = buy zone
    if (levelIndex <= 1 && price < nearestLevel) {
      if (Math.abs(price - this.lastBuyLevel) / price > 0.02) { // Don't buy at same level twice
        this.lastBuyLevel = price;
        return this.createVote(
          'LONG',
          60 + (2 - levelIndex) * 10,
          `Grid buy zone! Level ${levelIndex + 1}/5, price near $${nearestLevel.toFixed(2)}`,
          data.symbol
        );
      }
    }

    // Price at upper grid levels = sell zone
    if (levelIndex >= 3 && price > nearestLevel) {
      if (Math.abs(price - this.lastSellLevel) / price > 0.02) {
        this.lastSellLevel = price;
        return this.createVote(
          'SHORT',
          60 + (levelIndex - 2) * 10,
          `Grid sell zone! Level ${levelIndex + 1}/5, price near $${nearestLevel.toFixed(2)}`,
          data.symbol
        );
      }
    }

    // Middle of grid - wait
    return this.createVote(
      'HOLD',
      40,
      `Mid-grid (level ${levelIndex + 1}/5). Waiting for extremes.`,
      data.symbol
    );
  }
}
