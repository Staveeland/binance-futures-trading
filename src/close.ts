#!/usr/bin/env npx ts-node

import { client, formatUSDT, formatNumber } from './client.js';

async function closePosition() {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.log('\n🚪 Close Position (Futures)\n');
    console.log('Usage: npm run close <symbol> [percent]');
    console.log('\nExamples:');
    console.log('  npm run close BTC           # Close entire BTC position');
    console.log('  npm run close ETH 50        # Close 50% of ETH position');
    console.log('  npm run close all           # Close ALL positions');
    process.exit(1);
  }

  const input = args[0].toUpperCase();
  const percent = parseFloat(args[1]) || 100;

  try {
    // Get account with positions
    const account = await client.getAccountInformation();
    const openPositions = account.positions.filter(p => parseFloat(p.positionAmt) !== 0);

    if (openPositions.length === 0) {
      console.log('\n📭 No open positions to close');
      process.exit(0);
    }

    // Close all positions
    if (input === 'ALL') {
      console.log('\n🚪 Closing ALL positions...\n');
      
      for (const pos of openPositions) {
        await closeOnePosition(pos, 100);
      }
      
      console.log('\n✅ All positions closed!');
      process.exit(0);
    }

    // Close specific symbol
    const symbol = input.endsWith('USDT') ? input : `${input}USDT`;
    const position = openPositions.find(p => p.symbol === symbol);

    if (!position) {
      console.log(`\n❌ No open position for ${symbol}`);
      console.log('\n📈 Your open positions:');
      for (const pos of openPositions) {
        const size = parseFloat(pos.positionAmt);
        const side = size > 0 ? 'LONG' : 'SHORT';
        console.log(`   ${pos.symbol}: ${side} ${formatNumber(Math.abs(size), 4)}`);
      }
      process.exit(1);
    }

    await closeOnePosition(position, percent);

  } catch (error: any) {
    console.error('\n❌ Error closing position:', error.message);
    if (error.body) {
      console.error('   Details:', error.body);
    }
    process.exit(1);
  }
}

async function closeOnePosition(position: any, percent: number) {
  const size = parseFloat(position.positionAmt);
  const side = size > 0 ? 'LONG' : 'SHORT';
  const absSize = Math.abs(size);
  const pnl = parseFloat(position.unrealizedProfit);
  const entryPrice = parseFloat(position.entryPrice);
  const markPrice = parseFloat(position.markPrice);

  console.log(`🚪 Closing ${percent}% of ${position.symbol} ${side}`);
  console.log(`   Size: ${formatNumber(absSize, 4)}`);
  console.log(`   Entry: ${formatUSDT(entryPrice)}`);
  console.log(`   Mark: ${formatUSDT(markPrice)}`);
  console.log(`   Unrealized PnL: ${pnl >= 0 ? '\x1b[32m' : '\x1b[31m'}${formatUSDT(pnl)}\x1b[0m`);

  // Calculate close quantity
  const closeQuantity = absSize * (percent / 100);
  
  // Get symbol precision
  const exchangeInfo = await client.getExchangeInfo();
  const symbolInfo = exchangeInfo.symbols.find(s => s.symbol === position.symbol);
  const lotSizeFilter = symbolInfo?.filters.find((f: any) => f.filterType === 'LOT_SIZE') as any;
  const stepSize = parseFloat(lotSizeFilter?.stepSize || '0.001');
  const precision = Math.max(0, Math.round(-Math.log10(stepSize)));
  const quantity = Math.floor(closeQuantity / stepSize) * stepSize;
  const quantityStr = quantity.toFixed(precision);

  // To close: opposite side of current position
  // LONG position (positive) -> SELL to close
  // SHORT position (negative) -> BUY to close
  const closeSide = size > 0 ? 'SELL' : 'BUY';

  const order = await client.submitNewOrder({
    symbol: position.symbol,
    side: closeSide,
    type: 'MARKET',
    quantity: parseFloat(quantityStr),
    reduceOnly: 'true',
  });

  console.log(`\n✅ Position closed!`);
  console.log(`   Order ID: ${order.orderId}`);
  console.log(`   Status: ${order.status}`);
  
  if ('avgPrice' in order && order.avgPrice) {
    const realizedPnl = size > 0 
      ? (parseFloat(order.avgPrice) - entryPrice) * parseFloat(quantityStr)
      : (entryPrice - parseFloat(order.avgPrice)) * parseFloat(quantityStr);
    console.log(`   Close Price: ${formatUSDT(parseFloat(order.avgPrice))}`);
    console.log(`   Realized PnL: ${realizedPnl >= 0 ? '\x1b[32m' : '\x1b[31m'}~${formatUSDT(realizedPnl)}\x1b[0m`);
  }
}

closePosition();
