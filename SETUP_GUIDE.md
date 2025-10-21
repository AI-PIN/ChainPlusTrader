# Setup Guide for ChainPlusTrader

This guide will help you set up ChainPlusTrader on your local machine or deploy it to production.

## 🚀 Quick Start

### Option 1: Local Development

1. **Clone the repository:**
```bash
git clone https://github.com/YOUR_USERNAME/chainplustrader.git
cd chainplustrader
```

2. **Install dependencies:**
```bash
npm install
```

3. **Create environment file:**
```bash
cp .env.example .env
```

4. **Configure your .env file** (see Configuration section below)

5. **Set up database:**
```bash
npm run db:push
```

6. **Start the development server:**
```bash
npm run dev
```

Visit `http://localhost:5000` in your browser.

---

## 🔧 Configuration

### Database Setup

**Option A: PostgreSQL (Local)**

Install PostgreSQL locally, then set:
```env
DATABASE_URL=postgresql://username:password@localhost:5432/chainplustrader
```

**Option B: Neon (Cloud - Recommended)**

1. Sign up at [neon.tech](https://neon.tech/)
2. Create a new project
3. Copy the connection string:
```env
DATABASE_URL=postgresql://user:pass@host.neon.tech/database?sslmode=require
```

### Authentication Setup

**Option A: Simple Local Auth (Development)**

For local testing, you can disable Replit Auth by modifying the auth configuration or using a simple username/password system.

**Option B: Replit Auth (Production)**

If deploying on Replit, these are automatically set:
```env
ISSUER_URL=https://replit.com/oidc
REPL_ID=your-repl-id
REPLIT_DOMAINS=your-app.replit.dev
```

### Session Security

Generate a secure random string:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Add to `.env`:
```env
SESSION_SECRET=your_generated_string_here
```

### Blockchain Configuration

#### 1. Get RPC Endpoints

**Ethereum:**
- [Alchemy](https://www.alchemy.com/) (Recommended) - 300M compute units/month free
- [Infura](https://infura.io/) - 100k requests/day free
- Public: `https://eth.llamarpc.com` (rate limited)

**Base:**
- [Alchemy](https://www.alchemy.com/) (Best for Base)
- Public: `https://mainnet.base.org` (very strict rate limits)

**BNB Chain:**
- [NodeReal](https://nodereal.io/)
- Public: `https://bsc-dataseed.binance.org/` (moderate limits)

**Solana:**
- [Helius](https://www.helius.dev/) - 100k requests/day free
- [QuickNode](https://www.quicknode.com/)
- Public: `https://api.mainnet-beta.solana.com` (strict limits)

Add to `.env`:
```env
RPC_URL_ETH=https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY
RPC_URL_BASE=https://base-mainnet.g.alchemy.com/v2/YOUR_API_KEY
RPC_URL_BNB=https://bsc-dataseed.binance.org/
RPC_URL_SOL=https://api.mainnet-beta.solana.com
```

#### 2. Generate Trading Wallets

⚠️ **IMPORTANT**: Create NEW wallets specifically for this bot. Never use your main wallet!

**For EVM Chains (ETH, BASE, BNB):**

Use any Ethereum wallet:
- [MetaMask](https://metamask.io/)
- [Trust Wallet](https://trustwallet.com/)
- Or generate programmatically:

```javascript
// Node.js
const { ethers } = require('ethers');
const wallet = ethers.Wallet.createRandom();
console.log('Address:', wallet.address);
console.log('Private Key:', wallet.privateKey);
```

**For Solana:**

Use:
- [Phantom Wallet](https://phantom.app/)
- [Solflare](https://solflare.com/)
- Or generate using:

```bash
solana-keygen new --outfile ~/trading-wallet.json
```

Add private keys to `.env`:
```env
PRIVATE_KEY_ETH=0x1234567890abcdef...
PRIVATE_KEY_BASE=0x1234567890abcdef...
PRIVATE_KEY_BNB=0x1234567890abcdef...
PRIVATE_KEY_SOL=5J2z8... (base58 encoded)
```

#### 3. Fund Your Wallets

Send small amounts of native tokens to each wallet:
- **ETH wallet**: 0.01-0.05 ETH (~$40-200)
- **BASE wallet**: 0.01-0.05 ETH (~$40-200)
- **BNB wallet**: 0.05-0.1 BNB (~$30-60)
- **SOL wallet**: 0.1-0.5 SOL (~$15-75)

Start with small amounts for testing!

---

## 📝 Database Migrations

### Initial Setup
```bash
npm run db:push
```

### When Schema Changes
```bash
npm run db:push --force
```

### Generate Migration (if needed)
```bash
npm run db:generate
```

---

## 🧪 Testing Your Setup

1. **Start the server:**
```bash
npm run dev
```

2. **Check the dashboard** at `http://localhost:5000`

3. **Test manual trade** with a small amount (~$1-5):
   - Go to Manual Trading page
   - Select a network
   - Enter a popular token address (e.g., USDC)
   - Set amount to $1
   - Execute trade

4. **Common test tokens:**

**Ethereum:**
- USDC: `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`
- USDT: `0xdAC17F958D2ee523a2206206994597C13D831ec7`

**Base:**
- USDC: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- DEGEN: `0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed`

**BNB Chain:**
- USDC: `0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d`
- BUSD: `0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56`

**Solana:**
- USDC: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`
- BONK: `DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263`

---

## 🚀 Production Deployment

### Deploying to Replit

1. Import this repository to Replit
2. Replit will auto-configure most settings
3. Add secrets in the Secrets panel (never in code!)
4. Click "Run" to start

### Deploying to Other Platforms

**Vercel / Netlify:**
- Not recommended (need persistent backend)

**Railway / Render / Fly.io:**
1. Connect your GitHub repository
2. Set all environment variables in the platform dashboard
3. Use the `npm run dev` command to start
4. Ensure PostgreSQL database is provisioned

**VPS (DigitalOcean, AWS, etc.):**
1. SSH into your server
2. Install Node.js 18+
3. Clone repository
4. Install PostgreSQL
5. Configure `.env`
6. Use PM2 to keep it running:

```bash
npm install -g pm2
pm2 start "npm run dev" --name chainplustrader
pm2 save
pm2 startup
```

---

## 🔐 Security Checklist

Before going live:

- [ ] Never commit `.env` file to Git
- [ ] Use separate wallets (not your main wallet)
- [ ] Enable 2FA on RPC provider accounts
- [ ] Start with small trading amounts
- [ ] Use paid RPC endpoints in production
- [ ] Regularly monitor bot performance
- [ ] Set appropriate gas ratio limits
- [ ] Test thoroughly on testnet first (if available)
- [ ] Keep private keys in environment variables only
- [ ] Regularly update dependencies

---

## 🐛 Common Issues

### "Database connection failed"
- Check `DATABASE_URL` is correct
- Ensure database server is running
- Verify network connectivity

### "Rate limit exceeded"
- Upgrade to paid RPC provider
- Reduce trading frequency
- Add delays between trades

### "Insufficient funds"
- Ensure wallet has enough native tokens
- Check gas fees aren't consuming all balance
- Verify you're on the correct network

### "Cannot find module"
- Run `npm install` again
- Delete `node_modules` and reinstall
- Check Node.js version (needs 18+)

---

## 📞 Getting Help

- Check the main README.md
- Review error logs in console
- Open an issue on GitHub
- Review existing GitHub issues

---

**Happy Trading! 🚀**

Remember: Start small, test thoroughly, and never risk more than you can afford to lose.
