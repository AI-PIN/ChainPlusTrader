# Cross-Chain Trading Bot Dashboard

## Overview

A professional automated DeFi trading platform that executes cross-chain trades across Ethereum, Base, BNB Chain, and Solana networks. The system supports **independent trading bots for each network**, allowing simultaneous operation across multiple chains with separate configurations. Features include real-time monitoring, automated trade execution via scheduled intervals, manual trading capabilities, and comprehensive trade history tracking. Built with a focus on data transparency, safety features (gas ratio limits, slippage tolerance), and institutional-grade execution.

## Recent Updates (October 2025)

**Multi-Network Bot Support**: The system now supports running independent trading bots on each blockchain network simultaneously. Each network (ETH, BASE, BNB, SOL) can have its own:
- Unique contract address and wallet configuration
- Independent trading parameters (interval, amount, slippage)
- Separate bot status and control (start/stop per network)
- Per-network statistics and trade history

**Database Enhancements**:
- `bot_status` table: Added unique constraint on (userId, network) - enforces one bot status per user per network
- `trade_configs` table: Added partial unique index on (user_id, network) WHERE is_active - enforces one active config per user per network
- Storage layer: All methods now accept network parameter for per-network operations

**Frontend Updates**:
- Automated Trading page: Network selector loads/saves configurations per network independently
- Dashboard: Displays 4 network cards (one per network) with individual start/stop controls and status indicators

**Uniswap Version Selection (ETH & BASE)**:
- **Multi-Version Support**: ETH and BASE networks support Uniswap V2, V3, and V4 (V4 UI ready, backend pending)
  - **V3 Features**: All common fee tiers (0.01%, 0.05%, 0.3%, 1%), automatic best-quote pool selection
  - **V2 Compatibility**: Full support for legacy V2 pools
  - **V4 Roadmap**: UI selector implemented, backend integration in progress
- **Manual Version Selection**: Available in both Automated Trading and Manual Trading pages
  - **Auto-detect mode** (default): Tries V3 first, falls back to V2 if no pool found
  - **V2 Only**: Forces use of Uniswap V2
  - **V3 Only**: Forces use of Uniswap V3
  - **V4 Only**: Shows "under development" message (UI ready, integration pending)
- **Enhanced Error Handling**:
  - Token contract validation before swap attempts
  - Liquidity pool existence checks with clear error messages
  - Structured logging for diagnostics (token address, error codes, fee tiers, version used)
  - User-friendly error messages for invalid tokens, missing pools, or insufficient liquidity
  - **Automatic retry with exponential backoff** for RPC rate limit errors (429 errors)
    - **Standard retry**: 3 retries, 1-2s initial delay, up to 10s max (ETH, BNB, SOL)
    - **BASE network enhanced retry**: 5 retries, 2.5s initial delay, up to 20s max (due to stricter free RPC limits)
    - Additional 500ms delays between Uniswap V3 fee tier checks on BASE to reduce request rate
    - Handles transient network failures and API rate limiting gracefully
    - Applies to all blockchain RPC calls (contract queries, gas estimation, transaction sending)

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React with TypeScript using Vite as the build tool

**UI Component System**: shadcn/ui (Radix UI primitives) configured with "new-york" style
- Custom design system following financial dashboard patterns (inspired by Coinbase Pro, TradingView)
- Dark mode primary with professional restraint aesthetic
- Tailwind CSS for styling with custom HSL color variables
- Typography: Inter for UI, JetBrains Mono for numerical/monospace data

**State Management**: 
- TanStack Query (React Query) for server state and real-time data synchronization
- React Hook Form with Zod validation for form management
- WebSocket integration for live bot status and trade updates

**Routing**: Wouter (lightweight client-side routing)

**Key Pages**:
- Dashboard: Real-time bot status, performance metrics, network-separated statistics (ETH/BASE/BNB/SOL), recent trades
- Automated Trading: Configure and manage scheduled trading bots
- Manual Trading: Execute immediate trades with confirmation dialogs
- Trade History: Filterable log of all transactions with explorer links
- Configuration: Network credential status display

### Backend Architecture

**Runtime**: Node.js with Express.js server

**Language**: TypeScript with ES modules

**API Design**: RESTful endpoints with WebSocket support for real-time updates
- Authentication required for all trading endpoints
- Structured error handling with status codes
- Request logging middleware for API routes

**Core Services**:

1. **Trading Service** (`tradingService.ts`):
   - Multi-chain trade execution (EVM chains via Web3.js, Solana via @solana/web3.js)
   - Network-specific RPC connection management
   - DEX routing: Uniswap V2 (ETH), BaseSwap (BASE), PancakeSwap V2 (BNB), Jupiter (SOL)
   - Gas fee validation and slippage protection
   - Real blockchain transactions with actual DEX integration
   - Real-time price fetching via CoinGecko API with 30-second caching and fallback prices

2. **Bot Scheduler** (`botScheduler.ts`):
   - Cron-based automated trade execution
   - Configurable intervals: 1min, 5min, 10min, 30min, 1hour
   - Per-user bot instance management
   - Automatic status updates and next trade time calculation
   - WebSocket broadcaster dependency injection for real-time dashboard updates

3. **Storage Layer** (`storage.ts`):
   - Abstracted database operations via IStorage interface
   - User, trade config, trade log, and bot status management
   - Drizzle ORM for type-safe database queries
   - Network-specific statistics aggregation (total trades, gas fees, volume per chain)

### Database Architecture

**ORM**: Drizzle ORM with PostgreSQL dialect

**Database Provider**: Neon Serverless PostgreSQL (configured for Replit deployment)

**Schema Design**:

1. **sessions** - Passport session storage (required for authentication)
2. **users** - User profiles with OAuth fields (id, email, name, profile image)
3. **tradeConfigs** - Trading bot configurations
   - Network, DEX, token address, wallet address
   - Trade parameters: interval, amount, slippage, gas ratio
   - Active/inactive status flags
4. **tradeLogs** - Complete trade execution history
   - Transaction hashes, amounts, fees, prices
   - Status tracking (pending, completed, failed)
   - Profit/loss calculations
5. **botStatus** - Per-user bot state tracking
   - Running status, active config reference
   - Performance metrics: total trades, success rate, volume
   - Next scheduled trade time

**Migrations**: Managed via drizzle-kit (configured in `drizzle.config.ts`)

### Authentication & Authorization

**Strategy**: OpenID Connect (OIDC) via Replit Auth
- Passport.js with openid-client strategy
- Session-based authentication using connect-pg-simple for PostgreSQL session storage
- Mandatory user object storage (getUser/upsertUser methods)
- Protected routes via `isAuthenticated` middleware
- 7-day session TTL with HTTP-only secure cookies

### Real-Time Communication

**WebSocket Implementation**:
- Dedicated WebSocket server on HTTP upgrade
- Per-user client connection tracking
- Event types: `bot_status`, `new_trade`
- Automatic React Query cache invalidation on updates
- Authentication via userId message on connection
- Dependency injection pattern: Bot scheduler receives broadcaster function from routes.ts
- Real-time dashboard updates after automated trades complete

### External Dependencies

**Blockchain Networks**:
- Ethereum (ETH) - Web3.js with custom RPC endpoint
- Base Network - Web3.js with custom RPC endpoint
- BNB Chain - Web3.js with custom RPC endpoint
- Solana (SOL) - @solana/web3.js with custom RPC endpoint

**Required Environment Variables**:
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Session encryption key
- `ISSUER_URL` - OIDC provider URL (default: https://replit.com/oidc)
- `REPL_ID` - Replit deployment identifier
- `REPLIT_DOMAINS` - Allowed domain list
- Network-specific: `RPC_URL_ETH`, `RPC_URL_BASE`, `RPC_URL_BNB`, `RPC_URL_SOL`
- Network-specific: `PRIVATE_KEY_ETH`, `PRIVATE_KEY_BASE`, `PRIVATE_KEY_BNB`, `PRIVATE_KEY_SOL`

**Third-Party Services**:
- Blockchain explorers: Etherscan, Basescan, BSCScan, Solscan (for transaction verification)
- DEX protocols: Uniswap V2/V3, PancakeSwap, Jupiter (trade execution)
- Google Fonts: Inter, JetBrains Mono (typography)

**Key NPM Packages**:
- Database: `drizzle-orm`, `@neondatabase/serverless`, `ws` (WebSocket constructor)
- Authentication: `passport`, `openid-client`, `express-session`, `connect-pg-simple`, `memoizee`
- Blockchain: `web3`, `@solana/web3.js`
- Scheduling: `node-cron`
- Frontend: `@tanstack/react-query`, `react-hook-form`, `@hookform/resolvers`, `zod`, `wouter`
- UI Components: Multiple `@radix-ui/*` packages, `tailwindcss`, `class-variance-authority`

### Design Patterns & Conventions

**Code Organization**:
- Shared types/schemas in `/shared` directory (accessible to both client and server)
- Path aliases: `@/` for client, `@shared/` for shared code
- Separation of concerns: routes, storage, services, scheduling

**Validation**:
- Zod schemas for runtime type validation
- Drizzle Zod integration for database schema validation
- Form validation via `@hookform/resolvers`

**Error Handling**:
- Centralized error middleware in Express
- 401 detection utility for unauthorized responses
- User-friendly toast notifications for errors

**Development Workflow**:
- TypeScript with strict mode enabled
- Vite HMR for fast development iteration
- Replit-specific plugins for runtime error overlay and dev tooling