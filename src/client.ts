import { USDMClient, WebsocketClient } from 'binance';
import { BINANCE_API_KEY, BINANCE_API_SECRET, TESTNET_BASE_URL, DEFAULT_LEVERAGE } from './config.js';

// Create Binance Futures client configured for testnet
export const client = new USDMClient({
  api_key: BINANCE_API_KEY,
  api_secret: BINANCE_API_SECRET,
  baseUrl: TESTNET_BASE_URL,
});

// WebSocket client for real-time data (futures)
export const wsClient = new WebsocketClient({
  api_key: BINANCE_API_KEY,
  api_secret: BINANCE_API_SECRET,
  beautify: true,
});

// Helper to format numbers
export function formatNumber(num: number, decimals = 2): string {
  return num.toLocaleString('en-US', { 
    minimumFractionDigits: decimals, 
    maximumFractionDigits: decimals 
  });
}

// Helper to format USDT amounts
export function formatUSDT(amount: number): string {
  return `$${formatNumber(amount)}`;
}

// Helper to format crypto amounts
export function formatCrypto(amount: number, symbol: string): string {
  return `${formatNumber(amount, 8)} ${symbol}`;
}

// Set leverage for a symbol
export async function setLeverage(symbol: string, leverage: number = DEFAULT_LEVERAGE): Promise<void> {
  try {
    await client.setLeverage({ symbol, leverage });
    console.log(`⚙️  Leverage set to ${leverage}x for ${symbol}`);
  } catch (error: any) {
    // Ignore if leverage is already set
    if (!error.message?.includes('No need to change')) {
      throw error;
    }
  }
}

// Set margin type (ISOLATED or CROSSED)
export async function setMarginType(symbol: string, marginType: 'ISOLATED' | 'CROSSED' = 'ISOLATED'): Promise<void> {
  try {
    await client.setMarginType({ symbol, marginType });
    console.log(`⚙️  Margin type set to ${marginType} for ${symbol}`);
  } catch (error: any) {
    // Ignore if margin type is already set
    if (!error.message?.includes('No need to change')) {
      throw error;
    }
  }
}
