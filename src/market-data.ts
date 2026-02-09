import { client } from './client';
import { MarketData } from './agents/base-agent';

const priceCache: Map<string, number[]> = new Map();

export async function getMarketData(symbol: string): Promise<MarketData> {
  const ticker = `${symbol}USDT`;
  
  // Get 24h ticker data
  const ticker24h = await client.ticker24hr({ symbol: ticker });
  
  // Get recent klines for price history (1h candles, last 24)
  const klines = await client.klines({
    symbol: ticker,
    interval: '1h',
    limit: 24,
  });
  
  // Extract close prices from klines
  const prices = klines.map((k: any) => parseFloat(k[4])); // [4] is close price
  
  // Update price cache
  if (!priceCache.has(symbol)) {
    priceCache.set(symbol, []);
  }
  const cache = priceCache.get(symbol)!;
  cache.push(parseFloat(ticker24h.lastPrice));
  if (cache.length > 100) cache.shift();

  return {
    symbol,
    price: parseFloat(ticker24h.lastPrice),
    priceChange24h: parseFloat(ticker24h.priceChange),
    priceChangePercent24h: parseFloat(ticker24h.priceChangePercent),
    volume24h: parseFloat(ticker24h.volume),
    high24h: parseFloat(ticker24h.highPrice),
    low24h: parseFloat(ticker24h.lowPrice),
    prices: [...prices, ...cache.slice(-10)], // Combine hourly + recent
  };
}

export async function getMultipleMarketData(symbols: string[]): Promise<MarketData[]> {
  return Promise.all(symbols.map(s => getMarketData(s)));
}
