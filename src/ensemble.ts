import { client, setLeverage, setMarginType } from './client.js';
import { MetaAgent, TradeDecision } from './meta-agent.js';
import { BaseAgent, MarketData, Vote, Signal } from './agents/base-agent.js';
import { 
  AlphaMomentum, BetaMeanReversion, GammaBreakout, DeltaWhale,
  EpsilonScalper, ZetaGrid, EtaSentiment, ThetaDCA, 
  IotaArbitrage, KappaContrarian 
} from './agents/index.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { DEFAULT_LEVERAGE, TRAILING_STOP_PERCENT, STOP_LOSS_ROE } from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_FILE = path.join(__dirname, '..', 'state', 'ensemble-state.json');
const TRADES_FILE = path.join(__dirname, '..', 'state', 'trades.json');

interface EnsembleState {
  lastRun: number;
  totalTrades: number;
  totalProfit: number;
  agentWeights: Record<string, number>;
  positions: Record<string, { quantity: number; avgPrice: number; side: 'LONG' | 'SHORT' }>;
  peakPnl: Record<string, number>; // Track peak PnL per symbol for trailing stop
}

interface Trade {
  timestamp: number;
  symbol: string;
  action: 'LONG' | 'SHORT' | 'CLOSE';
  quantity: number;
  price: number;
  leverage: number;
  decision: TradeDecision;
}

export class EnsembleTradingSystem {
  private agents: BaseAgent[];
  private metaAgent: MetaAgent;
  private state: EnsembleState;
  private symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'];
  private leverage = DEFAULT_LEVERAGE;

  constructor() {
    this.agents = [
      new AlphaMomentum(),
      new BetaMeanReversion(),
      new GammaBreakout(),
      new DeltaWhale(),
      new EpsilonScalper(),
      new ZetaGrid(),
      new EtaSentiment(),
      new ThetaDCA(),
      new IotaArbitrage(),
      new KappaContrarian(),
    ];
    this.metaAgent = new MetaAgent();
    this.state = this.loadState();
  }

  private loadState(): EnsembleState {
    const defaultState: EnsembleState = {
      lastRun: 0,
      totalTrades: 0,
      totalProfit: 0,
      agentWeights: Object.fromEntries(this.agents.map(a => [a.name, 1.0])),
      positions: {},
      peakPnl: {},
    };
    
    try {
      if (fs.existsSync(STATE_FILE)) {
        const loaded = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
        return { ...defaultState, ...loaded, agentWeights: loaded.agentWeights || defaultState.agentWeights };
      }
    } catch (e) {
      console.log('Creating new state file');
    }
    return defaultState;
  }

  private saveState(): void {
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(this.state, null, 2));
  }

  private saveTrade(trade: Trade): void {
    let trades: Trade[] = [];
    try {
      if (fs.existsSync(TRADES_FILE)) {
        trades = JSON.parse(fs.readFileSync(TRADES_FILE, 'utf-8'));
      }
    } catch (e) {}
    trades.push(trade);
    if (trades.length > 1000) trades = trades.slice(-1000);
    fs.writeFileSync(TRADES_FILE, JSON.stringify(trades, null, 2));
  }

  async fetchMarketData(symbol: string): Promise<MarketData> {
    // Get 24h ticker
    const ticker = await client.get24hrChangeStatistics({ symbol });
    
    // Get recent klines for price history
    const klines = await client.getKlines({ 
      symbol, 
      interval: '5m', 
      limit: 20 
    });

    // Get funding rate (futures-specific)
    let fundingRate = 0;
    let openInterest = 0;
    try {
      const fundingInfo = await client.getFundingRate({ symbol, limit: 1 });
      if (fundingInfo.length > 0) {
        fundingRate = parseFloat(fundingInfo[0].fundingRate);
      }
      const oiInfo = await client.getOpenInterest({ symbol });
      openInterest = parseFloat(oiInfo.openInterest);
    } catch (e) {}

    const prices = klines.map((k: any) => parseFloat(k[4])); // Close prices

    return {
      symbol,
      price: parseFloat(ticker.lastPrice),
      priceChange24h: parseFloat(ticker.priceChange),
      priceChangePercent24h: parseFloat(ticker.priceChangePercent),
      volume24h: parseFloat(ticker.volume),
      high24h: parseFloat(ticker.highPrice),
      low24h: parseFloat(ticker.lowPrice),
      prices,
      fundingRate,
      openInterest,
    };
  }

  async getAccountInfo(): Promise<{ walletBalance: number; unrealizedPnl: number; availableBalance: number }> {
    const account = await client.getAccountInformation();
    return {
      walletBalance: parseFloat(account.totalWalletBalance),
      unrealizedPnl: parseFloat(account.totalUnrealizedProfit),
      availableBalance: parseFloat(account.availableBalance),
    };
  }

  async getOpenPositions(): Promise<Array<{ symbol: string; side: 'LONG' | 'SHORT'; size: number; entryPrice: number; unrealizedPnl: number }>> {
    const account = await client.getAccountInformation();
    const positions = account.positions.filter((p: any) => parseFloat(p.positionAmt) !== 0);
    
    return positions.map((p: any) => {
      const size = parseFloat(p.positionAmt);
      return {
        symbol: p.symbol,
        side: size > 0 ? 'LONG' : 'SHORT' as const,
        size: Math.abs(size),
        entryPrice: parseFloat(p.entryPrice),
        unrealizedPnl: parseFloat(p.unrealizedProfit),
      };
    });
  }

  async run(): Promise<{ symbolVotes: Record<string, { votes: Vote[], decision: string }> }> {
    console.log('\n' + '='.repeat(60));
    console.log('🤖 FUTURES ENSEMBLE TRADING - RUN STARTED');
    console.log('='.repeat(60));
    console.log(`Time: ${new Date().toISOString()}`);
    console.log(`Leverage: ${this.leverage}x`);

    const accountInfo = await this.getAccountInfo();
    const openPositions = await this.getOpenPositions();
    
    console.log(`\n💰 Wallet Balance: $${accountInfo.walletBalance.toFixed(2)}`);
    console.log(`📈 Unrealized PnL: $${accountInfo.unrealizedPnl.toFixed(2)}`);
    console.log(`💵 Available: $${accountInfo.availableBalance.toFixed(2)}`);
    
    if (openPositions.length > 0) {
      console.log(`\n📊 Open Positions:`);
      for (const pos of openPositions) {
        const pnlColor = pos.unrealizedPnl >= 0 ? '\x1b[32m' : '\x1b[31m';
        console.log(`   ${pos.symbol} ${pos.side}: ${pos.size} @ $${pos.entryPrice.toFixed(2)} | PnL: ${pnlColor}$${pos.unrealizedPnl.toFixed(2)}\x1b[0m`);
      }

      // Check trailing stop and stop loss for each position
      for (const pos of openPositions) {
        const margin = pos.size * pos.entryPrice / this.leverage;
        const roe = (pos.unrealizedPnl / margin) * 100;

        // Update peak PnL
        const prevPeak = this.state.peakPnl[pos.symbol] || 0;
        if (pos.unrealizedPnl > prevPeak) {
          this.state.peakPnl[pos.symbol] = pos.unrealizedPnl;
          console.log(`   📈 New peak PnL for ${pos.symbol}: $${pos.unrealizedPnl.toFixed(2)}`);
        }

        const peakPnl = this.state.peakPnl[pos.symbol] || 0;

        // Trailing stop: close if PnL drops X% from peak (only if peak > $5)
        if (peakPnl > 5) {
          const trailingThreshold = peakPnl * (1 - TRAILING_STOP_PERCENT / 100);
          console.log(`   🔔 Trailing stop: $${trailingThreshold.toFixed(2)} (peak: $${peakPnl.toFixed(2)})`);
          
          if (pos.unrealizedPnl < trailingThreshold) {
            console.log(`\n🚨 TRAILING STOP TRIGGERED for ${pos.symbol}!`);
            console.log(`   Peak: $${peakPnl.toFixed(2)} → Current: $${pos.unrealizedPnl.toFixed(2)} (dropped ${((1 - pos.unrealizedPnl / peakPnl) * 100).toFixed(1)}%)`);
            await this.closePosition(pos.symbol, pos);
            delete this.state.peakPnl[pos.symbol];
            continue;
          }
        }

        // Stop loss: close if ROE hits threshold
        if (roe <= STOP_LOSS_ROE) {
          console.log(`\n🚨 STOP LOSS TRIGGERED for ${pos.symbol}!`);
          console.log(`   ROE: ${roe.toFixed(1)}% (limit: ${STOP_LOSS_ROE}%)`);
          await this.closePosition(pos.symbol, pos);
          delete this.state.peakPnl[pos.symbol];
          continue;
        }
      }
    }

    const agentWeights = new Map(Object.entries(this.state.agentWeights));
    const symbolVotes: Record<string, { votes: Vote[], decision: string }> = {};

    for (const symbol of this.symbols) {
      console.log(`\n${'─'.repeat(40)}`);
      console.log(`📈 Analyzing ${symbol}...`);
      
      try {
        const marketData = await this.fetchMarketData(symbol);
        console.log(`   Price: $${marketData.price.toFixed(2)} (${marketData.priceChangePercent24h > 0 ? '+' : ''}${marketData.priceChangePercent24h.toFixed(2)}%)`);
        if (marketData.fundingRate) {
          console.log(`   Funding Rate: ${(marketData.fundingRate * 100).toFixed(4)}%`);
        }

        // Collect votes from all agents
        const votes: Vote[] = [];
        for (const agent of this.agents) {
          const vote = await agent.analyze(marketData);
          votes.push(vote);
        }

        // Meta-agent aggregates and decides
        const decision = this.metaAgent.aggregateVotes(votes, agentWeights);
        
        // Map BUY/SELL to LONG/SHORT for futures
        let futuresAction = decision.action;
        if (decision.action === 'BUY') futuresAction = 'LONG';
        if (decision.action === 'SELL') futuresAction = 'SHORT';
        
        // Store votes for dashboard
        symbolVotes[symbol] = { votes, decision: futuresAction };
        
        console.log(`\n${decision.reasoning}`);
        console.log(`\n🎯 DECISION: ${futuresAction} (Position size: ${decision.positionSizePercent}%)`);

        // Check if we already have a position
        const existingPosition = openPositions.find(p => p.symbol === symbol);

        // Execute trade if not HOLD
        if (futuresAction !== 'HOLD' && decision.positionSizePercent > 0) {
          // If we have opposite position, close it first
          if (existingPosition && existingPosition.side !== futuresAction) {
            await this.closePosition(symbol, existingPosition);
          }
          
          // Only open new position if we don't already have one in same direction
          if (!existingPosition || existingPosition.side !== futuresAction) {
            await this.openPosition(futuresAction as 'LONG' | 'SHORT', symbol, accountInfo.availableBalance, decision.positionSizePercent, marketData.price, decision);
          } else {
            console.log(`   ⚠️ Already have ${existingPosition.side} position on ${symbol}`);
          }
        }

      } catch (error: any) {
        console.error(`   ❌ Error analyzing ${symbol}: ${error.message}`);
      }
    }

    this.state.lastRun = Date.now();
    this.saveState();

    console.log('\n' + '='.repeat(60));
    console.log('✅ RUN COMPLETE');
    console.log('='.repeat(60) + '\n');
    
    return { symbolVotes };
  }

  private async openPosition(
    side: 'LONG' | 'SHORT', 
    symbol: string, 
    availableBalance: number, 
    positionSizePercent: number, 
    currentPrice: number,
    decision: TradeDecision
  ): Promise<void> {
    const marginAmount = availableBalance * (positionSizePercent / 100);
    const notionalValue = marginAmount * this.leverage;
    const quantity = notionalValue / currentPrice;
    
    console.log(`\n🔄 Opening ${side} position...`);
    console.log(`   Margin: $${marginAmount.toFixed(2)}`);
    console.log(`   Notional: $${notionalValue.toFixed(2)} (${this.leverage}x)`);

    try {
      // Set leverage and margin type
      await setLeverage(symbol, this.leverage);
      await setMarginType(symbol, 'ISOLATED');

      // Get symbol precision
      const exchangeInfo = await client.getExchangeInfo();
      const symbolInfo = exchangeInfo.symbols.find((s: any) => s.symbol === symbol);
      const lotSizeFilter = symbolInfo?.filters.find((f: any) => f.filterType === 'LOT_SIZE') as any;
      const stepSize = parseFloat(lotSizeFilter?.stepSize || '0.001');
      const precision = Math.max(0, Math.round(-Math.log10(stepSize)));
      const roundedQty = Math.floor(quantity / stepSize) * stepSize;

      if (roundedQty <= 0) {
        console.log(`   ⚠️ Quantity too small`);
        return;
      }

      const order = await client.submitNewOrder({
        symbol,
        side: side === 'LONG' ? 'BUY' : 'SELL',
        type: 'MARKET',
        quantity: parseFloat(roundedQty.toFixed(precision)),
      });

      console.log(`   ✅ ${side} opened: ${roundedQty.toFixed(precision)} @ ~$${currentPrice.toFixed(2)}`);
      
      this.saveTrade({
        timestamp: Date.now(),
        symbol,
        action: side,
        quantity: roundedQty,
        price: currentPrice,
        leverage: this.leverage,
        decision,
      });

      this.state.totalTrades++;

    } catch (error: any) {
      console.error(`   ❌ Failed to open position: ${error.message}`);
    }
  }

  private async closePosition(symbol: string, position: { side: 'LONG' | 'SHORT'; size: number }): Promise<void> {
    console.log(`\n🔄 Closing ${position.side} position on ${symbol}...`);
    
    try {
      const closeSide = position.side === 'LONG' ? 'SELL' : 'BUY';
      
      const order = await client.submitNewOrder({
        symbol,
        side: closeSide,
        type: 'MARKET',
        quantity: position.size,
        reduceOnly: 'true',
      });

      console.log(`   ✅ Position closed`);
      this.state.totalTrades++;

    } catch (error: any) {
      console.error(`   ❌ Failed to close position: ${error.message}`);
    }
  }
}

// Run if called directly
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const system = new EnsembleTradingSystem();
  system.run().catch(console.error);
}
