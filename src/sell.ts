import { client, formatNumber, formatUSDT, formatCrypto } from './client.js';

const symbol = process.argv[2]?.toUpperCase() || 'BTC';
const amount = process.argv[3]; // Can be a number or 'all'
const pair = `${symbol}USDT`;

async function sell() {
  console.log(`\n💸 Market Sell ${symbol}\n`);
  console.log('─'.repeat(50));

  if (!process.argv[2] || !process.argv[3]) {
    console.log('Usage: npm run sell <SYMBOL> <AMOUNT|all>');
    console.log('Example: npm run sell BTC 0.001');
    console.log('         npm run sell ETH all');
    process.exit(1);
  }

  try {
    // Get current balance
    const accountInfo = await client.getAccountInformation();
    const balance = accountInfo.balances.find(b => b.asset === symbol);
    const available = parseFloat(balance?.free || '0');

    if (available === 0) {
      console.error(`❌ No ${symbol} available to sell`);
      process.exit(1);
    }

    // Get current price
    const ticker = await client.getSymbolPriceTicker({ symbol: pair });
    const price = parseFloat(ticker.price);

    // Determine quantity to sell
    let quantity: number;
    if (amount.toLowerCase() === 'all') {
      quantity = available;
    } else {
      quantity = parseFloat(amount);
      if (quantity > available) {
        console.error(`❌ Insufficient balance. Available: ${formatCrypto(available, symbol)}`);
        process.exit(1);
      }
    }

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

    const estimatedUSDT = finalQty * price;

    console.log(`📊 Current Price: ${formatUSDT(price)}`);
    console.log(`📦 Selling:       ${formatCrypto(finalQty, symbol)}`);
    console.log(`💵 Est. Receive:  ~${formatUSDT(estimatedUSDT)}`);
    console.log('─'.repeat(50));

    // Execute market sell
    const order = await client.submitNewOrder({
      symbol: pair,
      side: 'SELL',
      type: 'MARKET',
      quantity: finalQty,
    });

    console.log('\n✅ Order Executed!\n');
    console.log(`📋 Order ID:   ${order.orderId}`);
    console.log(`📊 Status:     ${order.status}`);
    console.log(`💰 Sold:       ${formatCrypto(parseFloat(order.executedQty), symbol)}`);
    console.log(`💵 Received:   ${formatUSDT(parseFloat(order.cummulativeQuoteQty))}`);
    
    const avgPrice = parseFloat(order.cummulativeQuoteQty) / parseFloat(order.executedQty);
    console.log(`📈 Avg Price:  ${formatUSDT(avgPrice)}`);
    console.log('─'.repeat(50));

  } catch (error: any) {
    console.error('❌ Error executing sell:', error.message);
    if (error.body) {
      console.error('Details:', JSON.parse(error.body));
    }
  }
}

sell();
