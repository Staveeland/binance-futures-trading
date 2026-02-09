#!/usr/bin/env npx ts-node

import { client, formatUSDT, setLeverage, setMarginType } from './client.js';
import { DEFAULT_LEVERAGE, MAX_POSITION_SIZE_PERCENT } from './config.js';

async function openShort() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('\n📉 Open SHORT Position (Futures)\n');
    console.log('Usage: npm run short <symbol> <usdt_amount> [leverage]');
    console.log('\nExamples:');
    console.log('  npm run short BTC 100       # Short $100 worth of BTC at default leverage');
    console.log('  npm run short ETH 50 20     # Short $50 worth of ETH at 20x leverage');
    console.log(`\nDefault leverage: ${DEFAULT_LEVERAGE}x`);
    process.exit(1);
  }

  const baseSymbol = args[0].toUpperCase();
  const symbol = baseSymbol.endsWith('USDT') ? baseSymbol : `${baseSymbol}USDT`;
  const usdtAmount = parseFloat(args[1]);
  const leverage = parseInt(args[2]) || DEFAULT_LEVERAGE;

  if (isNaN(usdtAmount) || usdtAmount <= 0) {
    console.error('❌ Invalid USDT amount');
    process.exit(1);
  }

  console.log(`\n📉 Opening SHORT position on ${symbol}`);
  console.log(`   Amount: ${formatUSDT(usdtAmount)}`);
  console.log(`   Leverage: ${leverage}x`);
  console.log(`   Notional Value: ${formatUSDT(usdtAmount * leverage)}`);

  try {
    // Check account balance
    const account = await client.getAccountInformation();
    const availableBalance = parseFloat(account.availableBalance);
    
    console.log(`\n💰 Available Balance: ${formatUSDT(availableBalance)}`);
    
    // Risk check
    const maxAmount = availableBalance * (MAX_POSITION_SIZE_PERCENT / 100);
    if (usdtAmount > maxAmount) {
      console.error(`\n❌ Amount exceeds ${MAX_POSITION_SIZE_PERCENT}% risk limit (max: ${formatUSDT(maxAmount)})`);
      process.exit(1);
    }
    
    if (usdtAmount > availableBalance) {
      console.error(`\n❌ Insufficient balance. You have ${formatUSDT(availableBalance)}`);
      process.exit(1);
    }

    // Get current price
    const ticker = await client.getSymbolPriceTicker({ symbol });
    const price = parseFloat(Array.isArray(ticker) ? ticker[0].price : ticker.price);
    console.log(`   Current Price: ${formatUSDT(price)}`);

    // Set leverage and margin type
    await setLeverage(symbol, leverage);
    await setMarginType(symbol, 'ISOLATED');

    // Calculate quantity (notional / price)
    const notionalValue = usdtAmount * leverage;
    const rawQuantity = notionalValue / price;
    
    // Get symbol info for precision
    const exchangeInfo = await client.getExchangeInfo();
    const symbolInfo = exchangeInfo.symbols.find(s => s.symbol === symbol);
    
    if (!symbolInfo) {
      console.error(`\n❌ Symbol ${symbol} not found`);
      process.exit(1);
    }

    // Find quantity precision
    const lotSizeFilter = symbolInfo.filters.find((f: any) => f.filterType === 'LOT_SIZE') as any;
    const stepSize = parseFloat(lotSizeFilter?.stepSize || '0.001');
    const precision = Math.max(0, Math.round(-Math.log10(stepSize)));
    const quantity = Math.floor(rawQuantity / stepSize) * stepSize;
    const quantityStr = quantity.toFixed(precision);

    console.log(`\n🎯 Order Details:`);
    console.log(`   Quantity: ${quantityStr} ${baseSymbol}`);
    console.log(`   Notional: ~${formatUSDT(quantity * price)}`);

    // Place market order (SELL to open short)
    const order = await client.submitNewOrder({
      symbol,
      side: 'SELL',
      type: 'MARKET',
      quantity: parseFloat(quantityStr),
    });

    console.log('\n✅ SHORT position opened!');
    console.log(`   Order ID: ${order.orderId}`);
    console.log(`   Status: ${order.status}`);
    
    if ('avgPrice' in order && order.avgPrice) {
      console.log(`   Avg Price: ${formatUSDT(parseFloat(order.avgPrice))}`);
    }

    console.log('\n💡 Use "npm run balance" to see your position');
    console.log('💡 Use "npm run close BTC" to close the position');

  } catch (error: any) {
    console.error('\n❌ Error opening position:', error.message);
    if (error.body) {
      console.error('   Details:', error.body);
    }
    process.exit(1);
  }
}

openShort();
