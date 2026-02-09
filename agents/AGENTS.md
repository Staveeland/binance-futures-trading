# Trading Agents System

This directory contains the memory and state for each autonomous trading agent.

## Agent Overview

| Agent | Emoji | Strategy | Focus |
|-------|-------|----------|-------|
| Alpha | 🦁 | Momentum Trading | Ride strong trends |
| Beta | 🐺 | Mean Reversion | Buy dips, sell rallies |
| Gamma | 🦅 | Breakout Hunter | Catch breakouts from ranges |
| Delta | 🐋 | Whale Tracker | Follow large orders |
| Epsilon | 🦊 | Scalper | Quick small profits |
| Zeta | 🦈 | Grid Trading | Buy/sell at fixed intervals |
| Eta | 🦉 | News Sentiment | Trade on market sentiment |
| Theta | 🐉 | DCA Bot | Dollar-cost averaging |
| Iota | 🦎 | Arbitrage Seeker | Cross-pair opportunities |
| Kappa | 🦬 | Contrarian | Bet against the crowd |

## How It Works

1. Each agent wakes up every 30 minutes via cron job
2. Agent reads its memory file (`agent-{name}.md`)
3. Analyzes current market conditions
4. Decides whether to trade based on strategy
5. Executes trade via Binance Testnet API
6. Updates memory with reasoning and results
7. Updates shared dashboard data

## Agent Memory Structure

Each agent's memory file contains:
- **Identity**: Name, strategy, personality
- **State**: Current positions, available capital
- **History**: Past trades with reasoning
- **Learnings**: What worked, what didn't
- **Evolution**: How strategy has adapted over time

## Shared Resources

- `../dashboard/data.json` - Dashboard data (all agents update this)
- `../state/portfolio.json` - Current portfolio state
- `../state/trades.json` - Complete trade history

## Rules

1. Never risk more than 10% of portfolio on single trade
2. Always set stop-loss (virtual, managed by agent)
3. Log ALL reasoning before trading
4. Learn from losses - update strategy
5. Compete with other agents but don't sabotage
