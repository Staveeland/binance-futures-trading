import { client } from './client';
import { MetaAgent } from './meta-agent';
import { 
  AlphaMomentum, BetaMeanReversion, GammaBreakout, DeltaWhale,
  EpsilonScalper, ZetaGrid, EtaSentiment, ThetaDCA, 
  IotaArbitrage, KappaContrarian 
} from './agents';
import { MarketData, Vote, Signal } from './agents/base-agent';

const SYMBOL = 'ETHUSDT';
const TRADE_AMOUNT = 100; // $100 trade

async function forceTrade() {
  console.log('\n🎯 FORCED TRADE TEST - ETHUSDT');
  console.log('═'.repeat(50));

  // Get market data
  const ticker = await client.get24hrChangeStatistics({ symbol: SYMBOL });
  const klines = await client.getKlines({ symbol: SYMBOL, interval: '5m', limit: 20 });
  const prices = klines.map((k: any) => parseFloat(k[4]));

  const marketData: MarketData = {
    symbol: SYMBOL,
    price: parseFloat(ticker.lastPrice),
    priceChange24h: parseFloat(ticker.priceChange),
    priceChangePercent24h: parseFloat(ticker.priceChangePercent),
    volume24h: parseFloat(ticker.volume),
    high24h: parseFloat(ticker.highPrice),
    low24h: parseFloat(ticker.lowPrice),
    prices,
  };

  console.log(`\n📈 ETH Price: $${marketData.price.toFixed(2)} (${marketData.priceChangePercent24h > 0 ? '+' : ''}${marketData.priceChangePercent24h.toFixed(2)}%)`);

  // Get votes from all agents
  const agents = [
    new AlphaMomentum(), new BetaMeanReversion(), new GammaBreakout(),
    new DeltaWhale(), new EpsilonScalper(), new ZetaGrid(),
    new EtaSentiment(), new ThetaDCA(), new IotaArbitrage(), new KappaContrarian()
  ];

  console.log('\n🗳️ AGENT VOTES (forced BUY/SELL only):');
  
  let buyVotes = 0;
  let sellVotes = 0;
  
  for (const agent of agents) {
    const vote = await agent.analyze(marketData);
    // Force HOLD votes to follow the slight lean
    let forcedSignal: Signal = vote.signal;
    if (vote.signal === 'HOLD') {
      // Use confidence to determine lean - if > 35 lean buy, else lean sell
      forcedSignal = vote.confidence > 35 ? 'BUY' : 'SELL';
    }
    
    if (forcedSignal === 'BUY') buyVotes++;
    else sellVotes++;
    
    const emoji = forcedSignal === 'BUY' ? '🟢' : '🔴';
    console.log(`${emoji} ${agent.name}: ${forcedSignal} (was ${vote.signal}, ${vote.confidence}%) - ${vote.reasoning}`);
  }

  const decision = buyVotes > sellVotes ? 'BUY' : 'SELL';
  const consensus = Math.max(buyVotes, sellVotes) / 10 * 100;

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`📊 FINAL: ${buyVotes} BUY vs ${sellVotes} SELL`);
  console.log(`🎯 DECISION: ${decision} (${consensus}% consensus)`);
  console.log(`💰 Trade amount: $${TRADE_AMOUNT}`);

  // Execute the trade
  console.log(`\n🔄 Executing ${decision} order...`);
  
  try {
    if (decision === 'BUY') {
      const order = await client.submitNewOrder({
        symbol: SYMBOL,
        side: 'BUY',
        type: 'MARKET',
        quoteOrderQty: TRADE_AMOUNT,
      });
      console.log(`\n✅ BOUGHT ${order.executedQty} ETH @ ~$${marketData.price.toFixed(2)}`);
      console.log(`   Order ID: ${order.orderId}`);
    } else {
      // Get ETH balance first
      const account = await client.getAccountInformation();
      const ethBalance = account.balances.find((b: any) => b.asset === 'ETH');
      const available = ethBalance ? parseFloat(ethBalance.free) : 0;
      
      if (available > 0) {
        const sellQty = Math.min(available, TRADE_AMOUNT / marketData.price);
        const roundedQty = Math.floor(sellQty * 10000) / 10000;
        
        const order = await client.submitNewOrder({
          symbol: SYMBOL,
          side: 'SELL',
          type: 'MARKET',
          quantity: roundedQty,
        });
        console.log(`\n✅ SOLD ${order.executedQty} ETH @ ~$${marketData.price.toFixed(2)}`);
        console.log(`   Order ID: ${order.orderId}`);
      } else {
        console.log(`\n⚠️ No ETH to sell, doing BUY instead...`);
        const order = await client.submitNewOrder({
          symbol: SYMBOL,
          side: 'BUY',
          type: 'MARKET',
          quoteOrderQty: TRADE_AMOUNT,
        });
        console.log(`\n✅ BOUGHT ${order.executedQty} ETH @ ~$${marketData.price.toFixed(2)}`);
      }
    }
  } catch (error: any) {
    console.error(`\n❌ Trade failed: ${error.message}`);
  }

  console.log('\n' + '═'.repeat(50));
}

forceTrade().catch(console.error);
