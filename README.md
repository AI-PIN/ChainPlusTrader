# ChainPlusTrader

A professional cross-chain automated DeFi trading platform that executes real trades across Ethereum, Base, BNB Chain, and Solana networks.

## 🚀 Features

- **Multi-Chain Support**: Trade on ETH, BASE, BNB, and SOL networks simultaneously
- **Independent Network Bots**: Run separate automated trading bots for each blockchain
- **Uniswap Version Selection**: Choose between V2, V3, or auto-detect mode for ETH and BASE
- **Real-Time Price Integration**: Live price feeds via CoinGecko API
- **Automated Trading**: Schedule trades at configurable intervals (1min, 5min, 10min, 30min, 1hour)
- **Manual Trading**: Execute immediate trades with confirmation dialogs
- **Safety Features**: Gas ratio limits, slippage tolerance, and rate limit retry logic
- **WebSocket Updates**: Real-time dashboard updates via WebSocket
- **Trade History**: Complete transaction logs with blockchain explorer links

## 🛠️ Technology Stack

**Frontend:**
- React + TypeScript + Vite
- TailwindCSS + shadcn/ui components
- TanStack Query for state management
- Wouter for routing
- WebSocket for real-time updates

**Backend:**
- Node.js + Express + TypeScript
- Drizzle ORM + PostgreSQL (Neon)
- Web3.js for EVM chains (ETH, BASE, BNB)
- @solana/web3.js for Solana
- Passport.js + OpenID Connect authentication

**Blockchain Integrations:**
- Uniswap V2/V3 (ETH, BASE)
- PancakeSwap V2 (BNB)
- Jupiter (Solana)

## 📋 Prerequisites

- Node.js 18+ installed
- PostgreSQL database (or use [Neon](https://neon.tech/) free tier)
- Blockchain wallet private keys for each network you want to trade on
- RPC endpoints for each blockchain network

## 🔧 Installation

1. **Clone the repository:**
```bash
git clone https://github.com/YOUR_USERNAME/chainplustrader.git
cd chainplustrader
```

2. **Install dependencies:**
```bash
npm install
```

3. **Set up environment variables:**

Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Edit `.env` and fill in your configuration:

```env
# Database (required)
DATABASE_URL=postgresql://user:password@host:port/database

# Session security (required - generate a random string)
SESSION_SECRET=your-random-secret-here

# Authentication (optional - for Replit Auth, can use local auth)
ISSUER_URL=https://replit.com/oidc
REPL_ID=your-repl-id
REPLIT_DOMAINS=localhost:5000

# Blockchain RPC URLs (required for networks you want to trade on)
RPC_URL_ETH=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
RPC_URL_BASE=https://base-mainnet.g.alchemy.com/v2/YOUR_KEY
RPC_URL_BNB=https://bsc-dataseed.binance.org/
RPC_URL_SOL=https://api.mainnet-beta.solana.com

# Private keys (required - NEVER share these!)
PRIVATE_KEY_ETH=0xYOUR_PRIVATE_KEY
PRIVATE_KEY_BASE=0xYOUR_PRIVATE_KEY
PRIVATE_KEY_BNB=0xYOUR_PRIVATE_KEY
PRIVATE_KEY_SOL=YOUR_SOLANA_PRIVATE_KEY_BASE58
```

4. **Set up the database:**

Run database migrations:
```bash
npm run db:push
```

5. **Start the development server:**
```bash
npm run dev
```

The app will be available at `http://localhost:5000`

## 🔐 Security Best Practices

### Private Keys

⚠️ **NEVER commit your private keys to Git!**

- Store private keys in environment variables only
- Use separate wallets for trading (don't use your main wallet)
- Start with small amounts for testing
- The `.gitignore` file is configured to exclude `.env` files

### RPC Endpoints

For better rate limits and reliability, use paid RPC providers:

- **Ethereum & Base**: [Alchemy](https://www.alchemy.com/) (300M compute units/month free)
- **BNB Chain**: [QuickNode](https://www.quicknode.com/) or [NodeReal](https://nodereal.io/)
- **Solana**: [Helius](https://www.helius.dev/) or [QuickNode](https://www.quicknode.com/)

Free public endpoints have strict rate limits and may cause trade failures.

## 📚 Usage

### Setting Up a Trading Bot

1. Navigate to **Automated Trading** page
2. Select your blockchain network (ETH, BASE, BNB, or SOL)
3. Choose your DEX and version (Uniswap V2/V3 for ETH/BASE)
4. Enter the token contract address you want to trade
5. Set your trade amount, slippage tolerance, and interval
6. Click **Save Configuration**
7. Go to **Dashboard** and click **Start Bot** for that network

### Manual Trading

1. Navigate to **Manual Trading** page
2. Select network and configure parameters
3. Click **Execute Trade**
4. Confirm the transaction details
5. Trade executes immediately

### Viewing Trade History

- **Dashboard**: Shows recent trades across all networks
- **Trade History**: Complete searchable log with blockchain explorer links
- **Network Stats**: Per-network statistics (total trades, volume, gas fees)

## 🏗️ Project Structure

```
chainplustrader/
├── client/               # Frontend React app
│   └── src/
│       ├── components/   # UI components
│       ├── pages/        # Route pages
│       └── lib/          # Utilities
├── server/               # Backend Express server
│   ├── dex/             # DEX client implementations
│   ├── routes.ts        # API routes
│   ├── tradingService.ts # Core trading logic
│   ├── botScheduler.ts  # Automated bot scheduler
│   └── storage.ts       # Database layer
├── shared/              # Shared types and schemas
│   └── schema.ts        # Database schema + Zod validation
└── drizzle/             # Database migrations
```

## 🔄 Rate Limit Handling

The system includes automatic retry logic with exponential backoff:

- **Standard networks** (ETH, BNB, SOL): 3 retries, 1-10s delays
- **BASE network**: 5 retries, 2.5-20s delays (stricter free RPC limits)
- Automatically detects 429 errors and retries
- Logs retry attempts for debugging

## 🐛 Troubleshooting

### "Over rate limit" errors

**Solution**: Upgrade to a paid RPC provider (Alchemy, Infura, QuickNode)

### Database connection errors

**Solution**: Check your `DATABASE_URL` is correct and database is running

### Trade failures

**Checklist**:
- ✅ Wallet has sufficient native token balance (ETH, BNB, SOL)
- ✅ Token address is valid and has liquidity
- ✅ Slippage tolerance is appropriate (try 5-10% for volatile tokens)
- ✅ RPC endpoint is responsive

### Bot not starting

**Checklist**:
- ✅ Configuration is saved and active
- ✅ Private key is set for that network
- ✅ RPC URL is configured
- ✅ Check server logs for errors

## 📄 License

MIT License - feel free to use this project for your own trading needs!

## ⚠️ Disclaimer

**This software is for educational and research purposes only.**

- Trading cryptocurrencies involves substantial risk of loss
- The developers are not responsible for any financial losses
- Always test with small amounts first
- Never invest more than you can afford to lose
- Do your own research before trading any token

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📞 Support

For issues and questions:
- Open an issue on GitHub
- Check existing issues for solutions
- Review the troubleshooting section above

---

**Built with ❤️ for the DeFi community**
