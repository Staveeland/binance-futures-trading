import { BaseAgent, MarketData, Vote } from './base-agent.js';

export class IotaArbitrage extends BaseAgent {
  private priceHistory: Map<string, number[]> = new Map();

  constructor() {
    super(
      'Iota',
      'Arbitrage',
      'Looks for price inefficiencies and cross-pair opportunities.'
    );
  }

  async analyze(data: MarketData): Promise<Vote> {
    const { symbol, price, prices, high24h, low24h, priceChangePercent24h } = data;
    
    // Track price history for this symbol
    if (!this.priceHistory.has(symbol)) {
      this.priceHistory.set(symbol, []);
    }
    const history = this.priceHistory.get(symbol)!;
    history.push(price);
    if (history.length > 20) history.shift();

    // Calculate price efficiency (how much price deviates from expected)
    const expectedPrice = history.length > 5 
      ? history.slice(-5).reduce((a, b) => a + b, 0) / 5 
      : price;
    const inefficiency = ((price - expectedPrice) / expectedPrice) * 100;

    // Calculate spread (high-low as % of price) - wider spread = more opportunity
    const spread = ((high24h - low24h) / price) * 100;

    // Price significantly below expected (flash crash, inefficiency)
    if (inefficiency < -2 && spread > 3) {
      return this.createVote(
        'LONG',
        Math.min(85, 60 + Math.abs(inefficiency) * 5),
        `Arbitrage opportunity! Price ${inefficiency.toFixed(2)}% below expected. Spread ${spread.toFixed(1)}%.`,
        data.symbol
      );
    }

    // Price significantly above expected (flash pump, inefficiency)
    if (inefficiency > 2 && spread > 3) {
      return this.createVote(
        'SHORT',
        Math.min(85, 60 + inefficiency * 5),
        `Arbitrage opportunity! Price ${inefficiency.toFixed(2)}% above expected. Spread ${spread.toFixed(1)}%.`,
        data.symbol
      );
    }

    // Tight spread = efficient market, hard to arb
    if (spread < 1.5) {
      return this.createVote(
        'HOLD',
        20,
        `Market efficient - spread only ${spread.toFixed(2)}%. No arb opportunity.`,
        data.symbol
      );
    }

    // Wide spread but no clear direction
    if (spread > 4) {
      return this.createVote(
        'HOLD',
        50,
        `Wide spread (${spread.toFixed(1)}%) but price in equilibrium. Watching for inefficiency.`,
        data.symbol
      );
    }

    return this.createVote('HOLD', 30, 'No arbitrage signal', data.symbol);
  }
}
