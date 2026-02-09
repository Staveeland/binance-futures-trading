import { client, formatNumber, formatUSDT, formatCrypto } from './client.js';

const symbol = process.argv[2]?.toUpperCase() || 'BTC';
const amountUSDT = parseFloat(process.argv[3] || '100');
const pair = `${symbol}USDT`;

async function buy() {
  console.log(`\n🛒 Market Buy ${symbol}\n`);
  console.log('─'.repeat(50));

  if (!process.argv[2] || !process.argv[3]) {
    console.log('Usage: npm run buy <SYMBOL> <USDT_AMOUNT>');
    console.log('Example: npm run buy BTC 100');
    console.log('         npm run buy ETH 50');
    process.exit(1);
  }

  try {
    // Get current price
    const ticker = await client.getSymbolPriceTicker({ symbol: pair });
    const price = parseFloat(ticker.price);
    
    // Calculate quantity
    const quantity = amountUSDT / price;

    // Get symbol info for precision
    const exchangeInfo = await client.getExchangeInfo();
    const symbolInfo = exchangeInfo.symbols.find(s => s.symbol === pair);
    
    if (!symbolInfo) {
      console.error(`❌ Symbol ${pair} not found`);
      process.exit(1);
    }

    const lotSizeFilter = symbolInfo.filters.find((f: any) => f.filterType === 'LOT_SIZE') as any;
    const stepSize = parseFloat(lotSizeFilter.stepSize);
    const precision = Math.round(-Math.log10(stepSize));
    const adjustedQty = Math.floor(quantity / stepSize) * stepSize;
    const finalQty = parseFloat(adjustedQty.toFixed(precision));

    console.log(`📊 Current Price: ${formatUSDT(price)}`);
    console.log(`💵 Spending:      ${formatUSDT(amountUSDT)}`);
    console.log(`📦 Buying:        ~${formatCrypto(finalQty, symbol)}`);
    console.log('─'.repeat(50));

    // Execute market buy
    const order = await client.submitNewOrder({
      symbol: pair,
      side: 'BUY',
      type: 'MARKET',
      quoteOrderQty: amountUSDT, // Spend exact USDT amount
    });

    console.log('\n✅ Order Executed!\n');
    console.log(`📋 Order ID:   ${order.orderId}`);
    console.log(`📊 Status:     ${order.status}`);
    console.log(`💰 Filled:     ${formatCrypto(parseFloat(order.executedQty), symbol)}`);
    console.log(`💵 Spent:      ${formatUSDT(parseFloat(order.cummulativeQuoteQty))}`);
    
    const avgPrice = parseFloat(order.cummulativeQuoteQty) / parseFloat(order.executedQty);
    console.log(`📈 Avg Price:  ${formatUSDT(avgPrice)}`);
    console.log('─'.repeat(50));

  } catch (error: any) {
    console.error('❌ Error executing buy:', error.message);
    if (error.body) {
      console.error('Details:', JSON.parse(error.body));
    }
  }
}

buy();
