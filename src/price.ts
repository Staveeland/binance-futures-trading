import { client, formatNumber, formatUSDT } from './client.js';

const symbol = process.argv[2] || 'BTC';
const pair = `${symbol.toUpperCase()}USDT`;

async function getPrice() {
  console.log(`\n📈 ${pair} Price\n`);
  console.log('─'.repeat(50));

  try {
    // Get current price
    const ticker = await client.get24hrChangeStatistics({ symbol: pair });
    
    const price = parseFloat(ticker.lastPrice);
    const change = parseFloat(ticker.priceChangePercent);
    const high = parseFloat(ticker.highPrice);
    const low = parseFloat(ticker.lowPrice);
    const volume = parseFloat(ticker.volume);

    const changeEmoji = change >= 0 ? '🟢' : '🔴';
    const changeSign = change >= 0 ? '+' : '';

    console.log(`💵 Price:      ${formatUSDT(price)}`);
    console.log(`${changeEmoji} 24h Change: ${changeSign}${formatNumber(change)}%`);
    console.log(`📊 24h High:   ${formatUSDT(high)}`);
    console.log(`📉 24h Low:    ${formatUSDT(low)}`);
    console.log(`📦 24h Volume: ${formatNumber(volume, 2)} ${symbol.toUpperCase()}`);
    console.log('─'.repeat(50));

    // Get order book for bid/ask spread
    const orderBook = await client.getOrderBook({ symbol: pair, limit: 5 });
    const bestBid = parseFloat(orderBook.bids[0][0]);
    const bestAsk = parseFloat(orderBook.asks[0][0]);
    const spread = ((bestAsk - bestBid) / bestBid) * 100;

    console.log(`\n📖 Order Book (Top 5)`);
    console.log('─'.repeat(50));
    console.log('  ASK (Sell)');
    for (let i = 4; i >= 0; i--) {
      const [price, qty] = orderBook.asks[i];
      console.log(`  ${formatUSDT(parseFloat(price)).padStart(14)} | ${formatNumber(parseFloat(qty), 6)}`);
    }
    console.log('  ─'.repeat(20));
    console.log(`  Spread: ${formatNumber(spread, 4)}%`);
    console.log('  ─'.repeat(20));
    for (let i = 0; i < 5; i++) {
      const [price, qty] = orderBook.bids[i];
      console.log(`  ${formatUSDT(parseFloat(price)).padStart(14)} | ${formatNumber(parseFloat(qty), 6)}`);
    }
    console.log('  BID (Buy)');
    console.log('');

  } catch (error: any) {
    console.error('❌ Error fetching price:', error.message);
    if (error.message.includes('Invalid symbol')) {
      console.log(`\n💡 Try a different symbol, e.g.: npm run price ETH`);
    }
  }
}

getPrice();
