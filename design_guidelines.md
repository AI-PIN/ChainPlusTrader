# Cross-Chain Trading Bot Dashboard - Design Guidelines

## Design Approach: Crypto Trading Dashboard System
**Selected Framework**: Financial Dashboard Design (inspired by Coinbase Pro, Uniswap, TradingView)
**Rationale**: Trading applications demand precision, real-time clarity, and data-dense layouts. Users need instant visibility of status, performance metrics, and transaction history.

---

## Core Design Principles
1. **Data First**: Information hierarchy prioritizes critical trading data and status
2. **Trust Through Clarity**: Transparent display of all bot actions, gas fees, and transaction states
3. **Real-time Feedback**: Immediate visual updates for bot status changes and trade executions
4. **Professional Restraint**: Serious financial tool aesthetic with measured use of color for status communication

---

## Color Palette

### Dark Mode (Primary)
**Background Layers**:
- Primary Background: 220 15% 8%
- Card/Panel Background: 220 15% 12%
- Elevated Elements: 220 15% 16%

**Brand & Functional Colors**:
- Primary Accent (Actions): 210 85% 55% (Blue - trust, technology)
- Success (Active/Profit): 142 70% 45% (Green)
- Warning (Pending): 38 95% 60% (Amber)
- Error (Failed/Stop): 0 72% 55% (Red)
- Neutral Text: 220 15% 85%
- Muted Text: 220 10% 50%

### Network Identification Colors
- Ethereum: 240 100% 65%
- Base: 214 100% 50%
- BNB: 45 95% 50%
- Solana: 270 85% 60%

---

## Typography
**Font Family**: 
- Primary: 'Inter' (Google Fonts) - optimized for data display
- Monospace: 'JetBrains Mono' (Google Fonts) - for addresses, hashes, numerical data

**Type Scale**:
- Display (Bot Status): text-3xl font-bold
- Section Headers: text-xl font-semibold
- Data Labels: text-sm font-medium uppercase tracking-wide
- Data Values: text-lg font-semibold (monospace for numbers)
- Body/Descriptions: text-base
- Metadata: text-xs text-muted

---

## Layout System
**Spacing Units**: Tailwind units of 4, 6, 8, 12, 16 (consistent spacing rhythm)
- Card padding: p-6
- Section gaps: gap-8
- Element spacing: space-y-4
- Dashboard grid gaps: gap-6

**Container Strategy**:
- Max-width: max-w-7xl
- Dashboard grid: 12-column responsive grid
- Sidebar: fixed w-64 on desktop, collapsible on mobile

---

## Component Library

### A. Navigation & Layout
**Top Navigation Bar**:
- Fixed header with blur backdrop (backdrop-blur-lg bg-background/80)
- Network selector dropdown (pill-shaped, shows active chain with colored dot)
- Bot status indicator (prominent position, pulsing animation when active)
- User profile/logout button

**Sidebar Navigation** (Desktop):
- Dashboard (overview)
- Automated Trading (scheduler settings)
- Manual Trading (trigger tab)
- Trade History (logs)
- Configuration (settings)
- Icon + label format with active state highlight

### B. Dashboard Cards
**Status Card** (Hero position):
- Large bot status: "ACTIVE" / "PAUSED" / "ERROR"
- Current configuration summary (network, DEX, interval, amount)
- Next trade countdown timer
- Primary action button: Start/Stop Bot
- Background: subtle gradient overlay when active

**Metrics Grid** (3-column on desktop):
- Total Trades Today
- Total Volume (USD)
- Average Gas Fee
- Success Rate %
Each metric card with large number, label, and trend indicator

**Recent Trades Panel**:
- Table layout with columns: Time, Network, Token, Amount, Gas Fee, Status, TX Hash
- Color-coded status badges (success=green, pending=amber, failed=red)
- Expandable rows for transaction details
- Virtualized scrolling for performance

### C. Trading Controls

**Automated Trading Tab**:
- Configuration form with labeled inputs
- Trade interval selector (dropdown with presets: 1min, 5min, 10min, 30min, custom)
- Amount input with USD indicator
- Gas ratio slider (visual indicator when >0.8)
- Network/DEX selector with chain logos
- Schedule preview display
- Save Configuration button (primary)

**Manual Trading Tab**:
- Simplified quick-trade interface
- Token contract input with validation indicator
- Amount input (large, prominent)
- Current price display (fetched real-time)
- Estimated gas fee warning
- Execute Trade button (warning color, requires confirmation modal)
- Slippage tolerance setting

### D. Forms & Inputs
- Input fields: dark background (220 15% 10%), 1px border (220 15% 25%)
- Focus state: border color shifts to primary accent
- Labels: uppercase text-sm with spacing
- Helper text: text-xs text-muted below inputs
- Validation: inline error messages in red

### E. Data Visualization
**Trade Log Table**:
- Sticky header
- Alternating row backgrounds for readability
- Monospace font for addresses (truncated with copy button)
- Status column with colored badges
- Filter/search bar above table
- Export to CSV option

**Real-time Status Indicators**:
- Pulsing dot animation for active states
- Color-coded badges with border
- Loading spinners for pending operations

### F. Modals & Overlays
- Confirmation modal for manual trades
- Settings modal for advanced configuration
- Dark backdrop with blur (backdrop-blur-sm bg-black/50)
- Card-style modal content with shadow-2xl
- Clear cancel/confirm action buttons

---

## Animations
**Minimal & Purposeful**:
- Fade-in for new trade entries (300ms)
- Pulse animation for active bot indicator (2s loop)
- Smooth transitions for tab switches (200ms)
- Loading states: spinner for async operations
- No decorative animations - focus on functional feedback

---

## Authentication
**Login Screen**:
- Centered card layout on dark gradient background
- Replit Auth integration with branded button
- "Private Access Only" text indicator
- Minimalist, security-focused aesthetic

---

## Images
No hero images required. This is a data-focused dashboard. Use:
- Network logos/icons (ETH, BASE, BNB, SOL) from official sources
- DEX logos (Uniswap, PancakeSwap, Jupiter) as small brand identifiers
- Optional: Abstract geometric pattern as login page background (subtle, dark)

---

## Responsive Behavior
- Desktop (lg): Full dashboard grid with sidebar
- Tablet (md): Collapsible sidebar, 2-column metric grid
- Mobile (base): Stacked layout, bottom navigation tabs, single-column cards