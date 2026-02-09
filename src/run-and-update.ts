#!/usr/bin/env npx ts-node

import { EnsembleTradingSystem } from './ensemble.js';
import { client } from './client.js';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(__dirname, '../docs/data.json');

interface DashboardData {
  lastUpdate: string;
  account: {
    walletBalance: number;
    unrealizedPnl: number;
    marginBalance: number;
    availableBalance: number;
  };
  positions: Array<{
    symbol: string;
    side: 'LONG' | 'SHORT';
    size: number;
    entryPrice: number;
    markPrice: number;
    unrealizedPnl: number;
    leverage: number;
    margin: number;
    notional: number;
    liquidationPrice: number;
  }>;
  trades: Array<{
    time: string;
    symbol: string;
    side: string;
    size: number;
    price: number;
    pnl: number;
  }>;
  pnlHistory: Array<{ time: string; pnl: number }>;
  agentVotes: Record<string, {
    decision: string;
    votes: Array<{
      agent: string;
      action: string;
      confidence: number;
      reason: string;
    }>;
  }>;
}

async function runAndUpdate() {
  console.log('🚀 Running Futures Ensemble Trading System...\n');

  try {
    // Run the ensemble system
    const system = new EnsembleTradingSystem();
    const { symbolVotes } = await system.run();

    // Fetch account data for dashboard
    const account = await client.getAccountInformation();
    
    const walletBalance = parseFloat(account.totalWalletBalance);
    const unrealizedPnl = parseFloat(account.totalUnrealizedProfit);
    const marginBalance = parseFloat(account.totalMarginBalance);
    const availableBalance = parseFloat(account.availableBalance);

    // Get mark prices
    const markPrices: Record<string, number> = {};
    try {
      const allPrices = await client.getMarkPrice();
      for (const mp of allPrices) {
        markPrices[mp.symbol] = parseFloat(mp.markPrice);
      }
    } catch (e) {}

    // Get open positions
    const openPositions = account.positions.filter((p: any) => parseFloat(p.positionAmt) !== 0);
    const positions = openPositions.map((pos: any) => {
      const size = parseFloat(pos.positionAmt);
      const markPrice = markPrices[pos.symbol] || parseFloat(pos.entryPrice);
      return {
        symbol: pos.symbol,
        side: size > 0 ? 'LONG' : 'SHORT' as const,
        size: Math.abs(size),
        entryPrice: parseFloat(pos.entryPrice),
        markPrice,
        unrealizedPnl: parseFloat(pos.unrealizedProfit),
        leverage: parseInt(pos.leverage),
        margin: parseFloat(pos.isolatedWallet || '0'),
        notional: Math.abs(size) * markPrice,
        liquidationPrice: parseFloat(pos.liquidationPrice || '0'),
      };
    });

    // Get recent trades
    const trades: DashboardData['trades'] = [];
    const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'];
    for (const symbol of symbols) {
      try {
        const userTrades = await client.getAccountTrades({ symbol, limit: 10 });
        for (const trade of userTrades) {
          trades.push({
            time: new Date(trade.time).toLocaleString(),
            symbol: trade.symbol,
            side: trade.side,
            size: parseFloat(trade.qty),
            price: parseFloat(trade.price),
            pnl: parseFloat(trade.realizedPnl),
          });
        }
      } catch (e) {}
    }
    trades.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

    // Load existing data for history
    let existingData: Partial<DashboardData> = {};
    if (existsSync(DATA_PATH)) {
      try {
        existingData = JSON.parse(readFileSync(DATA_PATH, 'utf-8'));
      } catch (e) {}
    }

    // Update PnL history
    const pnlHistory = existingData.pnlHistory || [];
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    pnlHistory.push({ time: timeStr, pnl: unrealizedPnl });
    if (pnlHistory.length > 100) pnlHistory.shift();

    // Format agent votes for dashboard
    const agentVotes: DashboardData['agentVotes'] = {};
    for (const [symbol, data] of Object.entries(symbolVotes)) {
      const baseSymbol = symbol.replace('USDT', '');
      agentVotes[baseSymbol] = {
        decision: data.decision,
        votes: data.votes.map(v => ({
          agent: v.agent,
          action: v.signal,
          confidence: v.confidence,
          reason: v.reasoning,
        })),
      };
    }

    // Build dashboard data
    const dashboardData: DashboardData = {
      lastUpdate: now.toLocaleString(),
      account: {
        walletBalance,
        unrealizedPnl,
        marginBalance,
        availableBalance,
      },
      positions,
      trades: trades.slice(0, 20),
      pnlHistory,
      agentVotes,
    };

    // Write dashboard data
    writeFileSync(DATA_PATH, JSON.stringify(dashboardData, null, 2));
    console.log(`\n✅ Dashboard updated: docs/data.json`);

    // Summary
    console.log('\n📊 SUMMARY:');
    console.log(`   Wallet: $${walletBalance.toFixed(2)}`);
    console.log(`   Unrealized PnL: $${unrealizedPnl.toFixed(2)}`);
    console.log(`   Open Positions: ${positions.length}`);

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

runAndUpdate();
