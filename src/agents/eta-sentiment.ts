import { BaseAgent, MarketData, Vote } from './base-agent.js';

export class EtaSentiment extends BaseAgent {
  constructor() {
    super(
      'Eta',
      'News Sentiment',
      'Reacts to market sentiment and momentum shifts. Reads the room.'
    );
  }

  async analyze(data: MarketData): Promise<Vote> {
    const { priceChangePercent24h, volume24h, prices, high24h, low24h, price } = data;
    
    // Calculate momentum strength (combination of price change and consistency)
    const priceChanges: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      priceChanges.push((prices[i] - prices[i - 1]) / prices[i - 1] * 100);
    }
    
    const positiveChanges = priceChanges.filter(c => c > 0).length;
    const negativeChanges = priceChanges.filter(c => c < 0).length;
    const consistencyRatio = priceChanges.length > 0 
      ? Math.max(positiveChanges, negativeChanges) / priceChanges.length 
      : 0.5;

    // Fear indicator: big drop + high consistency of down moves
    if (priceChangePercent24h < -5 && consistencyRatio > 0.7 && negativeChanges > positiveChanges) {
      // Extreme fear = contrarian buy
      return this.createVote(
        'LONG',
        Math.min(80, 50 + Math.abs(priceChangePercent24h) * 2),
        `Extreme fear detected! Down ${priceChangePercent24h.toFixed(1)}% with ${(consistencyRatio * 100).toFixed(0)}% consistency. Contrarian buy.`,
        data.symbol
      );
    }

    // Greed indicator: big pump + consistent up moves
    if (priceChangePercent24h > 5 && consistencyRatio > 0.7 && positiveChanges > negativeChanges) {
      // Extreme greed = take profits
      return this.createVote(
        'SHORT',
        Math.min(80, 50 + priceChangePercent24h * 2),
        `Extreme greed detected! Up ${priceChangePercent24h.toFixed(1)}% with ${(consistencyRatio * 100).toFixed(0)}% consistency. Taking profits.`,
        data.symbol
      );
    }

    // Moderate bullish sentiment
    if (priceChangePercent24h > 2 && positiveChanges > negativeChanges) {
      return this.createVote('LONG', 45, `Bullish sentiment: +${priceChangePercent24h.toFixed(1)}%`, data.symbol);
    }

    // Moderate bearish sentiment
    if (priceChangePercent24h < -2 && negativeChanges > positiveChanges) {
      return this.createVote('SHORT', 45, `Bearish sentiment: ${priceChangePercent24h.toFixed(1)}%`, data.symbol);
    }

    return this.createVote('HOLD', 30, 'Mixed sentiment, no clear signal', data.symbol);
  }
}
