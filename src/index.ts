import { client, wsClient, formatNumber, formatUSDT } from './client.js';
import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question: string): Promise<string> {
  return new Promise(resolve => rl.question(question, resolve));
}

async function showMenu() {
  console.log('\n🤖 Binance Testnet Trading Bot\n');
  console.log('═'.repeat(50));
  console.log('  1. 💰 Check Balance');
  console.log('  2. 📈 Get Price (BTC, ETH, etc.)');
  console.log('  3. 🛒 Buy Crypto (Market Order)');
  console.log('  4. 💸 Sell Crypto (Market Order)');
  console.log('  5. 📊 Watch Price (Live)');
  console.log('  6. 📜 Order History');
  console.log('  0. 🚪 Exit');
  console.log('═'.repeat(50));
}

async function checkBalance() {
  console.log('\n💰 Fetching balance...\n');
  
  const accountInfo = await client.getAccountInformation();
  const btcPrice = await client.getSymbolPriceTicker({ symbol: 'BTCUSDT' });
  const btcUsdPrice = parseFloat(btcPrice.price);

  let totalUSD = 0;
  const balances = accountInfo.balances
    .filter(b => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0);

  console.log('─'.repeat(50));
  for (const balance of balances) {
    const free = parseFloat(balance.free);
    const locked = parseFloat(balance.locked);
    const total = free + locked;

    let usdValue = 0;
    if (balance.asset === 'USDT') {
      usdValue = total;
    } else if (balance.asset === 'BTC') {
      usdValue = total * btcUsdPrice;
    } else {
      try {
        const ticker = await client.getSymbolPriceTicker({ symbol: `${balance.asset}USDT` });
        usdValue = total * parseFloat(ticker.price);
      } catch {}
    }

    totalUSD += usdValue;
    const usdStr = usdValue > 0.01 ? ` ≈ ${formatUSDT(usdValue)}` : '';
    console.log(`${balance.asset.padEnd(6)} ${formatNumber(free, 8)}${usdStr}`);
  }
  console.log('─'.repeat(50));
  console.log(`📊 Total: ${formatUSDT(totalUSD)}`);
}

async function getPrice() {
  const symbol = await ask('Enter symbol (e.g., BTC, ETH): ');
  const pair = `${symbol.toUpperCase()}USDT`;
  
  try {
    const ticker = await client.get24hrChangeStatistics({ symbol: pair });
    const price = parseFloat(ticker.lastPrice);
    const change = parseFloat(ticker.priceChangePercent);
    
    const emoji = change >= 0 ? '🟢' : '🔴';
    const sign = change >= 0 ? '+' : '';
    
    console.log(`\n${pair}: ${formatUSDT(price)} ${emoji} ${sign}${formatNumber(change)}%`);
  } catch (e: any) {
    console.error('❌ Invalid symbol or error:', e.message);
  }
}

async function buyOrder() {
  const symbol = await ask('Enter symbol to buy (e.g., BTC, ETH): ');
  const amount = await ask('Enter USDT amount to spend: ');
  const pair = `${symbol.toUpperCase()}USDT`;

  try {
    const order = await client.submitNewOrder({
      symbol: pair,
      side: 'BUY',
      type: 'MARKET',
      quoteOrderQty: parseFloat(amount),
    });

    console.log('\n✅ Buy Order Executed!');
    console.log(`Bought: ${order.executedQty} ${symbol.toUpperCase()}`);
    console.log(`Spent: ${formatUSDT(parseFloat(order.cummulativeQuoteQty))}`);
  } catch (e: any) {
    console.error('❌ Error:', e.message);
  }
}

async function sellOrder() {
  const symbol = await ask('Enter symbol to sell (e.g., BTC, ETH): ');
  const amount = await ask('Enter amount to sell (or "all"): ');
  const pair = `${symbol.toUpperCase()}USDT`;

  try {
    let quantity: number;
    
    if (amount.toLowerCase() === 'all') {
      const accountInfo = await client.getAccountInformation();
      const balance = accountInfo.balances.find(b => b.asset === symbol.toUpperCase());
      quantity = parseFloat(balance?.free || '0');
    } else {
      quantity = parseFloat(amount);
    }

    // Get precision
    const exchangeInfo = await client.getExchangeInfo();
    const symbolInfo = exchangeInfo.symbols.find(s => s.symbol === pair);
    const lotSizeFilter = symbolInfo?.filters.find((f: any) => f.filterType === 'LOT_SIZE') as any;
    const stepSize = parseFloat(lotSizeFilter?.stepSize || '0.00001');
    const adjustedQty = Math.floor(quantity / stepSize) * stepSize;

    const order = await client.submitNewOrder({
      symbol: pair,
      side: 'SELL',
      type: 'MARKET',
      quantity: adjustedQty,
    });

    console.log('\n✅ Sell Order Executed!');
    console.log(`Sold: ${order.executedQty} ${symbol.toUpperCase()}`);
    console.log(`Received: ${formatUSDT(parseFloat(order.cummulativeQuoteQty))}`);
  } catch (e: any) {
    console.error('❌ Error:', e.message);
  }
}

async function watchPrice() {
  const symbol = await ask('Enter symbol to watch (e.g., BTC): ');
  const pair = `${symbol.toLowerCase()}usdt`;
  
  console.log(`\n👀 Watching ${symbol.toUpperCase()}/USDT (Ctrl+C to stop)\n`);

  wsClient.on('formattedMessage', (data: any) => {
    if (data.eventType === 'trade' && data.symbol === `${symbol.toUpperCase()}USDT`) {
      const price = parseFloat(data.price);
      const qty = parseFloat(data.quantity);
      const side = data.maker ? '🔴 SELL' : '🟢 BUY ';
      process.stdout.write(`\r${side} ${formatUSDT(price)} | ${formatNumber(qty, 6)} ${symbol.toUpperCase()}    `);
    }
  });

  wsClient.subscribeTrades(pair, 'spot');
}

async function orderHistory() {
  const symbol = await ask('Enter symbol (e.g., BTC, or press Enter for all): ');
  
  try {
    let orders;
    if (symbol) {
      orders = await client.getAccountTradeList({ symbol: `${symbol.toUpperCase()}USDT`, limit: 10 });
    } else {
      // Get BTC orders as default
      orders = await client.getAccountTradeList({ symbol: 'BTCUSDT', limit: 10 });
    }

    console.log('\n📜 Recent Trades:\n');
    console.log('─'.repeat(70));
    
    for (const trade of orders) {
      const side = trade.isBuyer ? '🟢 BUY ' : '🔴 SELL';
      const time = new Date(trade.time).toLocaleString();
      console.log(`${side} ${trade.qty} @ ${formatUSDT(parseFloat(trade.price))} | ${time}`);
    }
    console.log('─'.repeat(70));
  } catch (e: any) {
    console.error('❌ Error:', e.message);
  }
}

async function main() {
  console.log('\n🚀 Connecting to Binance Testnet...');
  
  // Test connection
  try {
    await client.getAccountInformation();
    console.log('✅ Connected successfully!\n');
  } catch (e: any) {
    console.error('❌ Connection failed:', e.message);
    process.exit(1);
  }

  while (true) {
    await showMenu();
    const choice = await ask('\nSelect option: ');

    switch (choice) {
      case '1':
        await checkBalance();
        break;
      case '2':
        await getPrice();
        break;
      case '3':
        await buyOrder();
        break;
      case '4':
        await sellOrder();
        break;
      case '5':
        await watchPrice();
        break;
      case '6':
        await orderHistory();
        break;
      case '0':
        console.log('\n👋 Goodbye!\n');
        rl.close();
        process.exit(0);
      default:
        console.log('❌ Invalid option');
    }
  }
}

main().catch(console.error);
