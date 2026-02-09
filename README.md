# Binance Futures Trading Bot 📈📉

Leverage trading bot for Binance Futures Testnet. Trade with up to 125x leverage using paper money!

## Features

- **Long positions** - Profit when price goes up
- **Short positions** - Profit when price goes down  
- **Leverage** - Control $10,000 with just $100 (at 100x)
- **Risk management** - Max 25% of balance per position
- **Paper trading** - Test strategies with fake money

## Quick Start

### 1. Get Futures Testnet API Keys

1. Go to [testnet.binancefuture.com](https://testnet.binancefuture.com/)
2. Login with GitHub
3. Go to API Management → Create API
4. Copy your API Key and Secret

### 2. Setup

```bash
cd binance-futures-trading
cp .env.example .env
# Edit .env with your Futures testnet API keys
npm install
```

### 3. Check Balance

```bash
npm run balance
```

## Commands

| Command | Description |
|---------|-------------|
| `npm run balance` | Show account balance and open positions |
| `npm run price BTC` | Get current BTC price |
| `npm run long BTC 100` | Open LONG with $100 (default 10x leverage) |
| `npm run long ETH 50 20` | Open LONG with $50 at 20x leverage |
| `npm run short BTC 100` | Open SHORT with $100 |
| `npm run short SOL 25 5` | Open SHORT with $25 at 5x leverage |
| `npm run close BTC` | Close entire BTC position |
| `npm run close ETH 50` | Close 50% of ETH position |
| `npm run close all` | Close ALL positions |

## How Leverage Works

With 10x leverage:
- You put in $100 (margin)
- You control $1,000 worth of BTC (notional)
- If BTC goes up 5% → You make $50 (50% gain!)
- If BTC goes down 5% → You lose $50 (50% loss!)
- If BTC goes down 10% → You get liquidated (100% loss)

**Higher leverage = Higher risk!**

## Risk Settings

Edit `src/config.ts`:

```typescript
export const DEFAULT_LEVERAGE = 10;      // Default leverage
export const MAX_LEVERAGE = 20;          // Safety cap
export const MAX_POSITION_SIZE_PERCENT = 25; // Max 25% of balance per trade
```

## Examples

### Bull Market Strategy (Long)
```bash
# Price is $100,000, you think it's going up
npm run long BTC 100 10   # $100 at 10x = $1000 exposure

# Price goes to $105,000 (5% up)
# Your profit: $50 (50% return on $100)
npm run close BTC
```

### Bear Market Strategy (Short)
```bash
# Price is $100,000, you think it's going down
npm run short BTC 100 10   # $100 at 10x = $1000 exposure

# Price drops to $95,000 (5% down)
# Your profit: $50 (50% return on $100)
npm run close BTC
```

## Important Notes

⚠️ **This is a TESTNET** - No real money involved!

- Futures testnet uses fake USDT (you start with some)
- API keys are different from spot testnet
- Perfect for learning leverage trading

## Links

- [Futures Testnet](https://testnet.binancefuture.com/)
- [Binance Futures API Docs](https://binance-docs.github.io/apidocs/futures/en/)
- [Spot Testnet Bot](../binance-testnet-trading/) (regular trading without leverage)
