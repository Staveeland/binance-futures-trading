export type Signal = 'LONG' | 'SHORT' | 'HOLD';

export interface Vote {
  agent: string;
  signal: Signal;
  confidence: number; // 0-100
  reasoning: string;
  symbol: string;
  timestamp: number;
}

export interface MarketData {
  symbol: string;
  price: number;
  priceChange24h: number;
  priceChangePercent24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  prices: number[]; // Recent price history
  fundingRate?: number; // Futures-specific
  openInterest?: number; // Futures-specific
}

export abstract class BaseAgent {
  name: string;
  strategy: string;
  description: string;
  weight: number = 1.0; // Voting weight, adjusted by performance
  wins: number = 0;
  losses: number = 0;

  constructor(name: string, strategy: string, description: string) {
    this.name = name;
    this.strategy = strategy;
    this.description = description;
  }

  abstract analyze(data: MarketData): Promise<Vote>;

  get winRate(): number {
    const total = this.wins + this.losses;
    return total > 0 ? this.wins / total : 0.5;
  }

  recordOutcome(profitable: boolean): void {
    if (profitable) {
      this.wins++;
      this.weight = Math.min(2.0, this.weight * 1.1);
    } else {
      this.losses++;
      this.weight = Math.max(0.5, this.weight * 0.95);
    }
  }

  protected createVote(signal: Signal, confidence: number, reasoning: string, symbol: string): Vote {
    return {
      agent: this.name,
      signal,
      confidence: Math.max(0, Math.min(100, confidence)),
      reasoning,
      symbol,
      timestamp: Date.now(),
    };
  }
}
