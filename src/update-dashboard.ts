#!/usr/bin/env npx ts-node

import { client } from './client.js';
import { writeFileSync, existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(__dirname, '../docs/data.json');

interface Position {
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
}

interface Trade {
  time: string;
  symbol: string;
  side: string;
  size: number;
  price: number;
  pnl: number;
}

interface DashboardData {
  lastUpdate: string;
  account: {
    walletBalance: number;
    unrealizedPnl: number;
    marginBalance: number;
    availableBalance: number;
  };
  positions: Position[];
  trades: Trade[];
  pnlHistory: { time: string; pnl: number }[];
}

async function updateDashboard() {
  console.log('📊 Updating futures dashboard...\n');

  try {
    // Get account info
    const account = await client.getAccountInformation();
    
    const walletBalance = parseFloat(account.totalWalletBalance);
    const unrealizedPnl = parseFloat(account.totalUnrealizedProfit);
    const marginBalance = parseFloat(account.totalMarginBalance);
    const availableBalance = parseFloat(account.availableBalance);

    console.log(`💰 Wallet: $${walletBalance.toFixed(2)}`);
    console.log(`📈 Unrealized PnL: $${unrealizedPnl.toFixed(2)}`);

    // Get open positions
    const positions: Position[] = [];
    const openPositions = account.positions.filter(p => parseFloat(p.positionAmt) !== 0);

    // Get mark prices for all symbols
    const markPrices: Record<string, number> = {};
    try {
      const allPrices = await client.getMarkPrice();
      for (const mp of allPrices) {
        markPrices[mp.symbol] = parseFloat(mp.markPrice);
      }
    } catch (e) {
      // Fallback: get individual prices
    }

    for (const pos of openPositions) {
      const size = parseFloat(pos.positionAmt);
      const side = size > 0 ? 'LONG' : 'SHORT';
      const markPrice = markPrices[pos.symbol] || parseFloat(pos.entryPrice);
      
      positions.push({
        symbol: pos.symbol,
        side,
        size: Math.abs(size),
        entryPrice: parseFloat(pos.entryPrice),
        markPrice,
        unrealizedPnl: parseFloat(pos.unrealizedProfit),
        leverage: parseInt(pos.leverage),
        margin: parseFloat(pos.isolatedWallet || '0'),
        notional: Math.abs(size) * markPrice,
        liquidationPrice: parseFloat(pos.liquidationPrice || '0')
      });

      console.log(`\n📍 ${pos.symbol} ${side}`);
      console.log(`   Size: ${Math.abs(size)}`);
      console.log(`   Entry: $${parseFloat(pos.entryPrice).toFixed(2)}`);
      console.log(`   Mark: $${markPrice.toFixed(2)}`);
      console.log(`   PnL: $${parseFloat(pos.unrealizedProfit).toFixed(2)}`);
    }

    if (positions.length === 0) {
      console.log('\n📭 No open positions');
    }

    // Get recent trades
    const trades: Trade[] = [];
    try {
      // Get trade history for common pairs
      const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'];
      for (const symbol of symbols) {
        const userTrades = await client.getAccountTrades({ symbol, limit: 10 });
        for (const trade of userTrades) {
          trades.push({
            time: new Date(trade.time).toLocaleString(),
            symbol: trade.symbol,
            side: trade.side,
            size: parseFloat(trade.qty),
            price: parseFloat(trade.price),
            pnl: parseFloat(trade.realizedPnl)
          });
        }
      }
      // Sort by time descending
      trades.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
    } catch (e) {
      // No trades yet
    }

    // Load existing data for history
    let existingData: DashboardData | null = null;
    if (existsSync(DATA_PATH)) {
      try {
        existingData = JSON.parse(readFileSync(DATA_PATH, 'utf-8'));
      } catch (e) {}
    }

    // Update PnL history
    const pnlHistory = existingData?.pnlHistory || [];
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    
    // Add new entry (max 100 entries)
    pnlHistory.push({ time: timeStr, pnl: unrealizedPnl });
    if (pnlHistory.length > 100) {
      pnlHistory.shift();
    }

    // Build dashboard data
    const dashboardData: DashboardData = {
      lastUpdate: now.toLocaleString(),
      account: {
        walletBalance,
        unrealizedPnl,
        marginBalance,
        availableBalance
      },
      positions,
      trades: trades.slice(0, 20),
      pnlHistory
    };

    // Write to file
    writeFileSync(DATA_PATH, JSON.stringify(dashboardData, null, 2));
    console.log(`\n✅ Dashboard updated: docs/data.json`);

  } catch (error: any) {
    console.error('❌ Error updating dashboard:', error.message);
    process.exit(1);
  }
}

updateDashboard();
