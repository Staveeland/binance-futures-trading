#!/usr/bin/env npx ts-node

import { client, formatUSDT, formatNumber } from './client.js';

async function showBalance() {
  console.log('\n📊 Binance Futures Testnet - Account Balance\n');
  console.log('━'.repeat(60));

  try {
    // Get futures account info
    const account = await client.getAccountInformation();
    
    console.log('\n💰 Account Summary:');
    console.log(`   Total Wallet Balance:    ${formatUSDT(parseFloat(account.totalWalletBalance))}`);
    console.log(`   Total Unrealized PnL:    ${formatUSDT(parseFloat(account.totalUnrealizedProfit))}`);
    console.log(`   Available Balance:       ${formatUSDT(parseFloat(account.availableBalance))}`);
    console.log(`   Total Margin Balance:    ${formatUSDT(parseFloat(account.totalMarginBalance))}`);
    
    // Show assets with balance
    const assetsWithBalance = account.assets.filter(a => parseFloat(a.walletBalance) > 0);
    
    if (assetsWithBalance.length > 0) {
      console.log('\n📦 Asset Balances:');
      console.log('─'.repeat(60));
      console.log(`${'Asset'.padEnd(10)} ${'Wallet'.padStart(15)} ${'Available'.padStart(15)} ${'Unrealized PnL'.padStart(15)}`);
      console.log('─'.repeat(60));
      
      for (const asset of assetsWithBalance) {
        console.log(
          `${asset.asset.padEnd(10)} ` +
          `${formatNumber(parseFloat(asset.walletBalance), 4).padStart(15)} ` +
          `${formatNumber(parseFloat(asset.availableBalance), 4).padStart(15)} ` +
          `${formatNumber(parseFloat(asset.unrealizedProfit), 4).padStart(15)}`
        );
      }
    }
    
    // Show open positions
    const positions = account.positions.filter(p => parseFloat(p.positionAmt) !== 0);
    
    if (positions.length > 0) {
      // Get mark prices
      const markPrices: Record<string, number> = {};
      try {
        const allPrices = await client.getMarkPrice();
        for (const mp of allPrices) {
          markPrices[mp.symbol] = parseFloat(mp.markPrice);
        }
      } catch (e) {}

      console.log('\n📈 Open Positions:');
      console.log('─'.repeat(80));
      console.log(`${'Symbol'.padEnd(12)} ${'Side'.padEnd(6)} ${'Size'.padStart(12)} ${'Entry'.padStart(12)} ${'Mark'.padStart(12)} ${'PnL'.padStart(12)} ${'Leverage'.padStart(8)}`);
      console.log('─'.repeat(80));
      
      for (const pos of positions) {
        const size = parseFloat(pos.positionAmt);
        const side = size > 0 ? 'LONG' : 'SHORT';
        const pnl = parseFloat(pos.unrealizedProfit);
        const pnlColor = pnl >= 0 ? '\x1b[32m' : '\x1b[31m';
        const markPrice = markPrices[pos.symbol] || parseFloat(pos.entryPrice);
        
        console.log(
          `${pos.symbol.padEnd(12)} ` +
          `${side.padEnd(6)} ` +
          `${formatNumber(Math.abs(size), 4).padStart(12)} ` +
          `${formatUSDT(parseFloat(pos.entryPrice)).padStart(12)} ` +
          `${formatUSDT(markPrice).padStart(12)} ` +
          `${pnlColor}${formatUSDT(pnl).padStart(12)}\x1b[0m ` +
          `${pos.leverage}x`.padStart(8)
        );
      }
    } else {
      console.log('\n📭 No open positions');
    }
    
    console.log('\n' + '━'.repeat(60));
    console.log('🔗 Futures Testnet: https://testnet.binancefuture.com');
    console.log('');
    
  } catch (error: any) {
    console.error('\n❌ Error fetching balance:', error.message);
    if (error.code === -2015) {
      console.log('\n💡 Tip: Make sure you have Futures Testnet API keys');
      console.log('   Get them at: https://testnet.binancefuture.com/');
    }
    process.exit(1);
  }
}

showBalance();
