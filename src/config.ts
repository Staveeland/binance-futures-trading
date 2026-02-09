import { config } from 'dotenv';
config();

export const BINANCE_API_KEY = process.env.BINANCE_API_KEY || '';
export const BINANCE_API_SECRET = process.env.BINANCE_API_SECRET || '';

// Binance Futures Testnet URLs
export const TESTNET_BASE_URL = 'https://testnet.binancefuture.com';
export const TESTNET_WS_URL = 'wss://stream.binancefuture.com';

// Default leverage (can be changed per trade)
export const DEFAULT_LEVERAGE = 10;

// Risk management
export const MAX_LEVERAGE = 20;
export const MAX_POSITION_SIZE_PERCENT = 25; // Max 25% of balance per position

// Auto-close rules
export const TRAILING_STOP_PERCENT = 30; // Close if PnL drops 30% from peak
export const STOP_LOSS_ROE = -25; // Close if ROE hits -25%

if (!BINANCE_API_KEY || !BINANCE_API_SECRET) {
  console.error('❌ Missing BINANCE_API_KEY or BINANCE_API_SECRET in .env');
  console.log('\n📝 Get Futures testnet API keys from: https://testnet.binancefuture.com/');
  process.exit(1);
}
