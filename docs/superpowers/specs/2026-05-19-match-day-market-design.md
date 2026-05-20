# Match Day Market — Design Spec

Internal prediction market for company cricket matches. Users get play-money coins and bet on match events through an AMM-driven market system.

## Overview

- **Users:** 15-50 people, authenticated via Google OAuth (company domain restricted)
- **Starting balance:** 1000 coins per user
- **Market types:** Binary (Yes/No, Team A/B) and multi-outcome (e.g., top scorer)
- **Pricing:** Constant-product AMM — odds shift based on betting volume
- **Betting windows:** Pre-match + live betting
- **Settlement:** Admin-triggered, system calculates payouts automatically

## Data Model

### User
- `id` (primary key)
- `email` (unique, from Google OAuth)
- `name` (from Google profile)
- `balance` (integer, coins — starts at 1000)
- `isAdmin` (derived from ADMIN_EMAILS env var, not stored)
- `createdAt`

### Match
- `id`
- `teamA` (string)
- `teamB` (string)
- `date` (datetime)
- `status` (enum: `upcoming`, `live`, `completed`)
- `createdAt`

### Market
- `id`
- `matchId` (foreign key → Match)
- `question` (string, e.g., "Who will win?")
- `status` (enum: `open`, `locked`, `settled`, `voided`)
- `type` (enum: `binary`, `multi`)
- `k` (float — AMM invariant, set on creation as product of initial pools, never changes)
- `resolvedOutcome` (nullable, set on settlement)
- `createdAt`

### Outcome
- `id`
- `marketId` (foreign key → Market)
- `label` (string, e.g., "India", "Yes", "Player X")
- `poolShares` (float — AMM liquidity pool for this outcome)

### Position
- `id`
- `userId` (foreign key → User)
- `marketId` (foreign key → Market)
- `outcomeId` (foreign key → Outcome)
- `shares` (float — number of shares held)
- `avgPrice` (float — average cost basis per share)

### Transaction
- `id`
- `userId` (foreign key → User)
- `marketId` (foreign key → Market)
- `outcomeId` (foreign key → Outcome)
- `type` (enum: `buy`, `sell`, `payout`, `refund`)
- `shares` (float)
- `coins` (float — coins spent or received)
- `createdAt`

## AMM Mechanics

### Constant-Product Formula

Each market maintains a pool of virtual shares per outcome. The invariant:

```
outcome1_pool * outcome2_pool = k (constant)
```

For multi-outcome markets: `product(all_outcome_pools) = k`.

### Pricing

Price of an outcome = (product of all OTHER outcome pools) / (sum of products for each outcome).

For binary markets this simplifies to:
- Price of A = `poolB / (poolA + poolB)`
- Price of B = `poolA / (poolA + poolB)`

Prices always sum to 1 (100%).

### Buying Shares

When a user spends `C` coins to buy shares of outcome A in a binary market:

1. Current state: `poolA * poolB = k`
2. The buy adds coins to the opposite pool: `newPoolB = poolB + C`
3. Maintain invariant: `newPoolA = k / newPoolB`
4. Shares received: `poolA - newPoolA`

### Selling Shares

Reverse of buying. User returns shares to the pool, receives coins from the opposite pool.

1. `newPoolA = poolA + sharesToSell`
2. `newPoolB = k / newPoolA`
3. Coins received: `poolB - newPoolB`

### Initial Liquidity

Admin sets initial liquidity when creating a market. For a binary market starting at 50/50:
- `poolA = poolB = initialLiquidity` (e.g., 100 each)
- `k = 10000`

Higher initial liquidity = prices move less per bet (more stable odds). Recommended: 100-500 depending on expected volume.

### Payout on Settlement

When a market is settled with winning outcome W:
- Each share of W pays out **100 coins**
- All other outcome shares pay 0
- `payout = user.shares[W] * 100`

## Pages & User Flow

### 1. Home / Match Hub (`/`)
- List of matches as cards
- Each card: team names, date, status badge (upcoming/live/completed), number of open markets
- Click a match card → navigate to match detail

### 2. Match Detail (`/match/[id]`)
- Match header: teams, date, status
- List of markets as cards, each showing:
  - Question text
  - Current odds as large percentages (e.g., "India 62% — Australia 38%")
  - Total volume in coins
  - Status badge (open/locked/settled)
- Click an outcome on a market card → inline bet slip expands

### 3. Market Bet Slip (inline on Match Detail)
- Expands below the market card when an outcome is clicked
- Shows: user's balance, amount input, estimated shares, avg price per share, potential payout
- Single "Buy [Outcome] Shares" button — no confirmation modal
- For existing positions: option to sell shares back

### 4. Portfolio (`/portfolio`)
- Coin balance at top
- Active positions: market question, outcome held, shares, current value, P&L
- Sell button per position
- Transaction history table (buy/sell/payout/refund with timestamps)

### 5. Leaderboard (`/leaderboard`)
- Ranked by total portfolio value (coin balance + current market value of all positions)
- Columns: rank, name, portfolio value, active positions count
- Polls every 3s during live matches

### 6. Admin: Match & Market Management (`/admin`)
- Create match form (teams, date)
- Per match: add market (question, outcomes, initial liquidity)
- Market controls: open / lock / settle / void
- Settlement: dropdown to pick winning outcome, confirm button
- Void: refunds all users at purchase price

### 7. Admin: User Management (`/admin/users`)
- Table of all users: name, email, balance, join date
- Adjust balance (add/remove coins, e.g., bonus coins)
- Domain whitelist display (from env var)

## Tech Stack

### Framework & Runtime
- **Next.js 15** (App Router) — single framework for frontend + API
- **React 19** — Server Components for pages, Client Components for interactive elements
- **TypeScript** — throughout

### Database
- **SQLite** via **Prisma ORM**
- Single file database, zero infrastructure
- Prisma handles migrations, type-safe queries
- SQLite's serialized writes prevent race conditions on bets

### Authentication
- **NextAuth.js v5** with Google OAuth provider
- Domain restriction via `ALLOWED_DOMAIN` env var (e.g., `company.com`)
- Admin check via `ADMIN_EMAILS` env var (comma-separated list)

### UI
- **Tailwind CSS** for styling
- Minimal component library — custom components, no heavy UI framework
- Dark theme (fits the betting/trading aesthetic)

### Real-time Updates
- Client-side polling every 3 seconds for live market odds
- `setInterval` + `fetch` on market detail and leaderboard pages
- No WebSocket/SSE complexity needed at this scale

## Project Structure

```
match-day-market/
├── app/
│   ├── layout.tsx                # Root layout, auth provider, nav
│   ├── page.tsx                  # Home — match hub
│   ├── match/[id]/page.tsx       # Match detail with markets
│   ├── portfolio/page.tsx        # User positions & history
│   ├── leaderboard/page.tsx      # Rankings
│   ├── admin/
│   │   ├── page.tsx              # Match & market management
│   │   └── users/page.tsx        # User management
│   └── api/
│       ├── auth/[...nextauth]/route.ts
│       ├── matches/route.ts      # GET (list), POST (create)
│       ├── matches/[id]/route.ts # GET, PATCH (status)
│       ├── markets/route.ts      # POST (create)
│       ├── markets/[id]/route.ts # GET (with odds), PATCH (lock/settle/void)
│       ├── trades/route.ts       # POST (buy/sell)
│       ├── portfolio/route.ts    # GET (user positions)
│       └── leaderboard/route.ts  # GET (rankings)
├── lib/
│   ├── amm.ts                    # Pure AMM math functions
│   ├── db.ts                     # Prisma client singleton
│   └── auth.ts                   # Auth helpers, admin check
├── components/
│   ├── MatchCard.tsx
│   ├── MarketCard.tsx
│   ├── BetSlip.tsx
│   ├── PositionCard.tsx
│   ├── Leaderboard.tsx
│   └── Nav.tsx
├── prisma/
│   └── schema.prisma
├── .env.local                    # Google OAuth creds, admin emails, domain
└── package.json
```

## API Routes

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/matches` | user | List all matches |
| POST | `/api/matches` | admin | Create a match |
| GET | `/api/matches/[id]` | user | Get match with markets |
| PATCH | `/api/matches/[id]` | admin | Update match status |
| POST | `/api/markets` | admin | Create market for a match |
| GET | `/api/markets/[id]` | user | Get market with current odds |
| PATCH | `/api/markets/[id]` | admin | Lock, settle, or void a market |
| POST | `/api/trades` | user | Place a buy or sell trade |
| GET | `/api/portfolio` | user | Get current user's positions |
| GET | `/api/leaderboard` | user | Get ranked user list |

## Settlement Flow

1. Admin navigates to the market in admin panel
2. Clicks "Settle", selects winning outcome from dropdown
3. API endpoint (PATCH `/api/markets/[id]`):
   - Validates market is `locked` or `open`
   - Sets `resolvedOutcome` and `status = settled`
   - Queries all positions for the winning outcome
   - Credits each user: `shares * 100` coins
   - Creates `payout` transaction records
   - All within a single Prisma transaction
4. Market card updates to show result and payout summary

### Voiding a Market
1. Admin clicks "Void" on a market
2. API refunds all users at their original purchase price (sum of `coins` from `buy` transactions minus `sell` transactions)
3. Creates `refund` transaction records
4. Market status set to `voided`

## Environment Variables

```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3000
ALLOWED_DOMAIN=company.com
ADMIN_EMAILS=alice@company.com,bob@company.com
STARTING_BALANCE=1000
```

## Deployment (Self-Hosted)

- Single Node.js process: `next start`
- SQLite file stored on disk (ensure persistent storage)
- Reverse proxy (nginx/caddy) for HTTPS
- Backup: periodic copy of the SQLite file
- No external services required beyond Google OAuth
