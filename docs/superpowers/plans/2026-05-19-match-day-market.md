# Match Day Market Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an internal prediction market web app for company cricket matches with play-money coins, AMM-driven odds, and admin-controlled settlement.

**Architecture:** Next.js 15 App Router monolith with Prisma + SQLite for persistence, Auth.js v5 (NextAuth) for Google OAuth, and shadcn/ui for the component library. All AMM logic lives in a pure `lib/amm.ts` module. Client-side polling (3s) for live odds updates.

**Tech Stack:** Next.js 15, React 19, TypeScript, Prisma (SQLite), Auth.js v5, shadcn/ui, Tailwind CSS v4

---

## File Structure

```
match-day-market/
├── app/
│   ├── layout.tsx                        # Root layout, providers, nav
│   ├── page.tsx                          # Home — match hub
│   ├── match/[id]/page.tsx               # Match detail with markets
│   ├── portfolio/page.tsx                # User positions & history
│   ├── leaderboard/page.tsx              # Rankings
│   ├── admin/
│   │   ├── page.tsx                      # Match & market management
│   │   └── users/page.tsx                # User management
│   └── api/
│       ├── auth/[...nextauth]/route.ts   # Auth.js route handler
│       ├── matches/route.ts              # GET (list), POST (create)
│       ├── matches/[id]/route.ts         # GET, PATCH (status)
│       ├── markets/route.ts              # POST (create)
│       ├── markets/[id]/route.ts         # GET (odds), PATCH (lock/settle/void)
│       ├── trades/route.ts               # POST (buy/sell)
│       ├── portfolio/route.ts            # GET (user positions)
│       └── leaderboard/route.ts          # GET (rankings)
├── lib/
│   ├── amm.ts                            # Pure AMM math functions
│   ├── amm.test.ts                       # AMM unit tests
│   ├── db.ts                             # Prisma client singleton
│   └── auth.ts                           # Auth config, helpers, admin check
├── components/
│   ├── providers.tsx                     # Session provider wrapper
│   ├── nav.tsx                           # Top navigation bar
│   ├── match-card.tsx                    # Match card for home page
│   ├── market-card.tsx                   # Market card with odds display
│   ├── bet-slip.tsx                      # Inline bet placement form
│   ├── position-card.tsx                 # Portfolio position display
│   └── admin/
│       ├── create-match-form.tsx         # Admin: create match
│       ├── create-market-form.tsx        # Admin: create market for a match
│       └── settle-market-dialog.tsx      # Admin: settle/void a market
├── prisma/
│   └── schema.prisma                     # Database schema
├── .env.local                            # Env vars (not committed)
├── package.json
└── vitest.config.ts                      # Test config
```

---

### Task 1: Project Scaffolding & Dependencies

**Files:**
- Create: `match-day-market/` (project root via create-next-app)
- Create: `vitest.config.ts`
- Modify: `package.json`

- [ ] **Step 1: Create Next.js project**

```bash
cd ~/src/work/match-day-market
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*" --turbopack
```

When prompted, accept defaults. This creates the Next.js 15 project with Tailwind CSS v4 and App Router.

- [ ] **Step 2: Install dependencies**

```bash
cd ~/src/work/match-day-market
npm install prisma @prisma/client next-auth@beta @auth/prisma-adapter
npm install -D vitest @vitejs/plugin-react
```

- [ ] **Step 3: Initialize shadcn/ui**

```bash
cd ~/src/work/match-day-market
npx shadcn@latest init
```

When prompted: select default style, neutral base color, and accept defaults.

- [ ] **Step 4: Add shadcn components**

```bash
cd ~/src/work/match-day-market
npx shadcn@latest add button card badge input label select dialog table tabs separator dropdown-menu avatar sonner
```

- [ ] **Step 5: Create vitest config**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
});
```

- [ ] **Step 6: Add test script to package.json**

Add to `package.json` scripts:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 7: Commit**

```bash
git init
echo "node_modules\n.next\n.env.local\nprisma/dev.db\nprisma/dev.db-journal" > .gitignore
git add -A
git commit -m "chore: scaffold Next.js project with shadcn/ui, Prisma, Auth.js, vitest"
```

---

### Task 2: Prisma Schema & Database Setup

**Files:**
- Create: `prisma/schema.prisma`
- Create: `lib/db.ts`
- Create: `.env.local`

- [ ] **Step 1: Initialize Prisma**

```bash
cd ~/src/work/match-day-market
npx prisma init --datasource-provider sqlite
```

- [ ] **Step 2: Write the schema**

Replace `prisma/schema.prisma` with:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model User {
  id           String        @id @default(cuid())
  email        String        @unique
  name         String?
  image        String?
  balance      Float         @default(1000)
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
  positions    Position[]
  transactions Transaction[]
  accounts     Account[]
  sessions     Session[]
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model Match {
  id        String      @id @default(cuid())
  teamA     String
  teamB     String
  date      DateTime
  status    String      @default("upcoming") // upcoming, live, completed
  createdAt DateTime    @default(now())
  markets   Market[]
}

model Market {
  id              String        @id @default(cuid())
  matchId         String
  question        String
  status          String        @default("open") // open, locked, settled, voided
  type            String        @default("binary") // binary, multi
  k               Float         // AMM invariant
  resolvedOutcome String?
  createdAt       DateTime      @default(now())
  match           Match         @relation(fields: [matchId], references: [id], onDelete: Cascade)
  outcomes        Outcome[]
  positions       Position[]
  transactions    Transaction[]
}

model Outcome {
  id           String        @id @default(cuid())
  marketId     String
  label        String
  poolShares   Float
  market       Market        @relation(fields: [marketId], references: [id], onDelete: Cascade)
  positions    Position[]
  transactions Transaction[]
}

model Position {
  id        String   @id @default(cuid())
  userId    String
  marketId  String
  outcomeId String
  shares    Float    @default(0)
  avgPrice  Float    @default(0)
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  market    Market   @relation(fields: [marketId], references: [id], onDelete: Cascade)
  outcome   Outcome  @relation(fields: [outcomeId], references: [id], onDelete: Cascade)

  @@unique([userId, marketId, outcomeId])
}

model Transaction {
  id        String   @id @default(cuid())
  userId    String
  marketId  String
  outcomeId String
  type      String   // buy, sell, payout, refund
  shares    Float
  coins     Float
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  market    Market   @relation(fields: [marketId], references: [id], onDelete: Cascade)
  outcome   Outcome  @relation(fields: [outcomeId], references: [id], onDelete: Cascade)
}
```

- [ ] **Step 3: Create `.env.local`**

```bash
DATABASE_URL="file:./dev.db"
AUTH_SECRET="generate-a-random-secret-here"
AUTH_GOOGLE_ID="your-google-client-id"
AUTH_GOOGLE_SECRET="your-google-client-secret"
ALLOWED_DOMAIN="company.com"
ADMIN_EMAILS="admin@company.com"
STARTING_BALANCE="1000"
```

- [ ] **Step 4: Run migration**

```bash
cd ~/src/work/match-day-market
npx prisma migrate dev --name init
```

Expected: creates `prisma/migrations/` directory and `prisma/dev.db`.

- [ ] **Step 5: Create Prisma client singleton**

Create `lib/db.ts`:

```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

- [ ] **Step 6: Verify Prisma works**

```bash
cd ~/src/work/match-day-market
npx prisma studio
```

Expected: opens browser with empty tables. Close it after confirming.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations lib/db.ts .env.local
git commit -m "feat: add Prisma schema with SQLite for all data models"
```

---

### Task 3: AMM Module (Pure Logic + Tests)

**Files:**
- Create: `lib/amm.ts`
- Create: `lib/amm.test.ts`

- [ ] **Step 1: Write AMM tests**

Create `lib/amm.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  getPrice,
  getBuyShares,
  getBuyCost,
  getSellReturn,
  getPrices,
} from "./amm";

describe("AMM - binary market pricing", () => {
  it("returns 50/50 odds for equal pools", () => {
    const prices = getPrices([100, 100]);
    expect(prices[0]).toBeCloseTo(0.5);
    expect(prices[1]).toBeCloseTo(0.5);
  });

  it("prices sum to 1", () => {
    const prices = getPrices([80, 120]);
    const sum = prices.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1);
  });

  it("higher pool means lower price for that outcome", () => {
    const prices = getPrices([150, 50]);
    expect(prices[0]).toBeLessThan(prices[1]);
  });
});

describe("AMM - buying shares", () => {
  it("returns correct shares for a buy", () => {
    // pools: [100, 100], k = 10000
    // buy 10 coins of outcome 0
    // newPool1 = 100 + 10 = 110, newPool0 = 10000/110 = 90.909
    // shares = 100 - 90.909 = 9.09
    const result = getBuyShares([100, 100], 0, 10);
    expect(result.shares).toBeCloseTo(9.0909, 2);
    expect(result.newPools[0]).toBeCloseTo(90.9091, 2);
    expect(result.newPools[1]).toBeCloseTo(110, 2);
  });

  it("buying shifts price up for that outcome", () => {
    const result = getBuyShares([100, 100], 0, 50);
    const newPrices = getPrices(result.newPools);
    expect(newPrices[0]).toBeGreaterThan(0.5);
  });

  it("preserves k invariant", () => {
    const pools = [100, 100];
    const k = pools[0] * pools[1];
    const result = getBuyShares(pools, 0, 30);
    const newK = result.newPools[0] * result.newPools[1];
    expect(newK).toBeCloseTo(k, 4);
  });
});

describe("AMM - selling shares", () => {
  it("returns correct coins for a sell", () => {
    // First buy some shares
    const buyResult = getBuyShares([100, 100], 0, 50);
    // Then sell them back
    const sellResult = getSellReturn(buyResult.newPools, 0, buyResult.shares);
    // Should get back approximately 50 coins (minus slippage from round-trip)
    expect(sellResult.coinsReturned).toBeCloseTo(50, 0);
  });

  it("preserves k invariant on sell", () => {
    const pools = [80, 120];
    const k = pools[0] * pools[1];
    const sellResult = getSellReturn(pools, 0, 5);
    const newK = sellResult.newPools[0] * sellResult.newPools[1];
    expect(newK).toBeCloseTo(k, 4);
  });
});

describe("AMM - multi-outcome markets", () => {
  it("prices sum to 1 for 3 outcomes", () => {
    const prices = getPrices([100, 100, 100]);
    const sum = prices.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1);
  });

  it("buying in 3-outcome market works", () => {
    const pools = [100, 100, 100];
    const result = getBuyShares(pools, 0, 20);
    expect(result.shares).toBeGreaterThan(0);
    const newPrices = getPrices(result.newPools);
    expect(newPrices[0]).toBeGreaterThan(1 / 3);
  });
});

describe("AMM - getBuyCost", () => {
  it("calculates cost to buy a specific number of shares", () => {
    const pools = [100, 100];
    const cost = getBuyCost(pools, 0, 9.0909);
    expect(cost).toBeCloseTo(10, 1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd ~/src/work/match-day-market
npx vitest run lib/amm.test.ts
```

Expected: FAIL — `lib/amm.ts` doesn't exist yet.

- [ ] **Step 3: Implement AMM module**

Create `lib/amm.ts`:

```typescript
/**
 * Constant-product AMM for prediction markets.
 *
 * For a binary market with pools [A, B], the invariant is A * B = k.
 * For multi-outcome markets, product(all pools) = k.
 */

/** Calculate price for each outcome. Price = product(other pools) / sum(product(other pools) for each). */
export function getPrices(pools: number[]): number[] {
  const products = pools.map((_, i) =>
    pools.reduce((acc, pool, j) => (j === i ? acc : acc * pool), 1)
  );
  const total = products.reduce((a, b) => a + b, 0);
  return products.map((p) => p / total);
}

/** Get price for a single outcome. */
export function getPrice(pools: number[], outcomeIndex: number): number {
  return getPrices(pools)[outcomeIndex];
}

/**
 * Buy shares of an outcome by spending `coins`.
 * Coins go into all OTHER outcome pools (split equally for multi-outcome).
 * Returns shares received and new pool state.
 */
export function getBuyShares(
  pools: number[],
  outcomeIndex: number,
  coins: number
): { shares: number; newPools: number[] } {
  const k = pools.reduce((a, b) => a * b, 1);
  const newPools = [...pools];

  // Add coins to all pools except the one being bought
  for (let i = 0; i < newPools.length; i++) {
    if (i !== outcomeIndex) {
      newPools[i] += coins / (pools.length - 1);
    }
  }

  // Restore invariant by adjusting the bought outcome's pool
  const otherProduct = newPools.reduce(
    (acc, pool, i) => (i === outcomeIndex ? acc : acc * pool),
    1
  );
  newPools[outcomeIndex] = k / otherProduct;

  const shares = pools[outcomeIndex] - newPools[outcomeIndex];
  return { shares, newPools };
}

/**
 * Calculate the cost in coins to buy a specific number of shares.
 * Uses binary search to find the coin amount that yields the target shares.
 */
export function getBuyCost(
  pools: number[],
  outcomeIndex: number,
  targetShares: number
): number {
  let lo = 0;
  let hi = pools[outcomeIndex] * 100; // upper bound
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    const result = getBuyShares(pools, outcomeIndex, mid);
    if (result.shares < targetShares) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return (lo + hi) / 2;
}

/**
 * Sell shares of an outcome back to the pool.
 * Returns coins received and new pool state.
 */
export function getSellReturn(
  pools: number[],
  outcomeIndex: number,
  shares: number
): { coinsReturned: number; newPools: number[] } {
  const k = pools.reduce((a, b) => a * b, 1);
  const newPools = [...pools];

  // Return shares to the pool
  newPools[outcomeIndex] += shares;

  // Restore invariant by adjusting other pools
  const targetOtherProduct = k / newPools[outcomeIndex];

  if (pools.length === 2) {
    // Binary: simple case
    const otherIndex = outcomeIndex === 0 ? 1 : 0;
    const oldOther = newPools[otherIndex];
    newPools[otherIndex] = targetOtherProduct;
    const coinsReturned = oldOther - newPools[otherIndex];
    return { coinsReturned, newPools };
  }

  // Multi-outcome: scale all other pools proportionally
  const currentOtherProduct = newPools.reduce(
    (acc, pool, i) => (i === outcomeIndex ? acc : acc * pool),
    1
  );
  const scaleFactor = Math.pow(
    targetOtherProduct / currentOtherProduct,
    1 / (pools.length - 1)
  );

  let coinsReturned = 0;
  for (let i = 0; i < newPools.length; i++) {
    if (i !== outcomeIndex) {
      const oldPool = newPools[i];
      newPools[i] = oldPool * scaleFactor;
      coinsReturned += oldPool - newPools[i];
    }
  }

  return { coinsReturned, newPools };
}

/** Calculate payout per share on settlement (always 100 coins). */
export const PAYOUT_PER_SHARE = 100;
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd ~/src/work/match-day-market
npx vitest run lib/amm.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/amm.ts lib/amm.test.ts vitest.config.ts
git commit -m "feat: implement constant-product AMM with full test coverage"
```

---

### Task 4: Authentication Setup

**Files:**
- Create: `lib/auth.ts`
- Create: `app/api/auth/[...nextauth]/route.ts`
- Create: `components/providers.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Create auth config**

Create `lib/auth.ts`:

```typescript
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [Google],
  callbacks: {
    async signIn({ user }) {
      const email = user.email;
      if (!email) return false;
      const allowedDomain = process.env.ALLOWED_DOMAIN;
      if (allowedDomain && !email.endsWith(`@${allowedDomain}`)) {
        return false;
      }
      return true;
    },
    async session({ session }) {
      if (session.user?.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: session.user.email },
          select: { id: true, balance: true },
        });
        if (dbUser) {
          session.user.id = dbUser.id;
          (session as any).balance = dbUser.balance;
        }
      }
      return session;
    },
  },
  pages: {
    signIn: "/",
  },
});

export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  const adminEmails = process.env.ADMIN_EMAILS?.split(",").map((e) =>
    e.trim()
  );
  return adminEmails?.includes(email) ?? false;
}

export async function getRequiredSession() {
  const session = await auth();
  if (!session?.user?.email) {
    throw new Error("Unauthorized");
  }
  return session;
}

export async function getRequiredAdmin() {
  const session = await getRequiredSession();
  if (!isAdmin(session.user.email)) {
    throw new Error("Forbidden");
  }
  return session;
}
```

- [ ] **Step 2: Create route handler**

Create `app/api/auth/[...nextauth]/route.ts`:

```typescript
import { handlers } from "@/lib/auth";
export const { GET, POST } = handlers;
```

- [ ] **Step 3: Create session provider**

Create `components/providers.tsx`:

```typescript
"use client";

import { SessionProvider } from "next-auth/react";

export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
```

- [ ] **Step 4: Update root layout**

Replace `app/layout.tsx`:

```typescript
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Nav } from "@/components/nav";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Match Day Market",
  description: "Cricket prediction market",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <Providers>
          <Nav />
          <main className="container mx-auto px-4 py-8 max-w-5xl">
            {children}
          </main>
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 5: Create navigation component**

Create `components/nav.tsx`:

```typescript
"use client";

import Link from "next/link";
import { useSession, signIn, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Nav() {
  const { data: session } = useSession();

  return (
    <nav className="border-b">
      <div className="container mx-auto px-4 max-w-5xl flex items-center justify-between h-14">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-bold text-lg">
            Match Day Market
          </Link>
          {session && (
            <>
              <Link
                href="/portfolio"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Portfolio
              </Link>
              <Link
                href="/leaderboard"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Leaderboard
              </Link>
            </>
          )}
        </div>
        <div className="flex items-center gap-4">
          {session ? (
            <>
              <span className="text-sm font-medium">
                {Math.round((session as any).balance ?? 0)} coins
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Avatar className="h-8 w-8 cursor-pointer">
                    <AvatarImage src={session.user?.image ?? ""} />
                    <AvatarFallback>
                      {session.user?.name?.[0] ?? "?"}
                    </AvatarFallback>
                  </Avatar>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href="/admin">Admin</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => signOut()}>
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Button onClick={() => signIn("google")} size="sm">
              Sign in with Google
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
}
```

- [ ] **Step 6: Verify auth flow**

```bash
cd ~/src/work/match-day-market
npm run dev
```

Visit `http://localhost:3000`. Verify: nav renders, sign-in button appears. Full OAuth flow requires valid Google credentials in `.env.local` — test manually once those are configured.

- [ ] **Step 7: Commit**

```bash
git add lib/auth.ts app/api/auth components/providers.tsx components/nav.tsx app/layout.tsx
git commit -m "feat: add Google OAuth with Auth.js v5, nav, session provider"
```

---

### Task 5: Match CRUD API + Admin UI

**Files:**
- Create: `app/api/matches/route.ts`
- Create: `app/api/matches/[id]/route.ts`
- Create: `app/admin/page.tsx`
- Create: `components/admin/create-match-form.tsx`

- [ ] **Step 1: Create matches API — list and create**

Create `app/api/matches/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getRequiredSession, getRequiredAdmin } from "@/lib/auth";

export async function GET() {
  try {
    await getRequiredSession();
    const matches = await prisma.match.findMany({
      include: {
        markets: {
          select: { id: true, status: true },
        },
      },
      orderBy: { date: "desc" },
    });
    return NextResponse.json(matches);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    await getRequiredAdmin();
    const body = await request.json();
    const match = await prisma.match.create({
      data: {
        teamA: body.teamA,
        teamB: body.teamB,
        date: new Date(body.date),
      },
    });
    return NextResponse.json(match, { status: 201 });
  } catch (e: any) {
    if (e.message === "Forbidden")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
```

- [ ] **Step 2: Create match detail API — get and update status**

Create `app/api/matches/[id]/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getRequiredSession, getRequiredAdmin } from "@/lib/auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await getRequiredSession();
    const { id } = await params;
    const match = await prisma.match.findUniqueOrThrow({
      where: { id },
      include: {
        markets: {
          include: { outcomes: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    return NextResponse.json(match);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await getRequiredAdmin();
    const { id } = await params;
    const body = await request.json();
    const match = await prisma.match.update({
      where: { id },
      data: { status: body.status },
    });
    return NextResponse.json(match);
  } catch (e: any) {
    if (e.message === "Forbidden")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
```

- [ ] **Step 3: Create match form component**

Create `components/admin/create-match-form.tsx`:

```typescript
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export function CreateMatchForm({ onCreated }: { onCreated: () => void }) {
  const [teamA, setTeamA] = useState("");
  const [teamB, setTeamB] = useState("");
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/matches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamA, teamB, date }),
    });
    setLoading(false);
    if (res.ok) {
      toast.success("Match created");
      setTeamA("");
      setTeamB("");
      setDate("");
      onCreated();
    } else {
      toast.error("Failed to create match");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Match</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="teamA">Team A</Label>
              <Input
                id="teamA"
                value={teamA}
                onChange={(e) => setTeamA(e.target.value)}
                placeholder="India"
                required
              />
            </div>
            <div>
              <Label htmlFor="teamB">Team B</Label>
              <Input
                id="teamB"
                value={teamB}
                onChange={(e) => setTeamB(e.target.value)}
                placeholder="Australia"
                required
              />
            </div>
          </div>
          <div>
            <Label htmlFor="date">Match Date</Label>
            <Input
              id="date"
              type="datetime-local"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? "Creating..." : "Create Match"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Create admin page**

Create `app/admin/page.tsx`:

```typescript
"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { CreateMatchForm } from "@/components/admin/create-match-form";
import { CreateMarketForm } from "@/components/admin/create-market-form";
import { SettleMarketDialog } from "@/components/admin/settle-market-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Match = {
  id: string;
  teamA: string;
  teamB: string;
  date: string;
  status: string;
  markets: {
    id: string;
    question: string;
    status: string;
    outcomes: { id: string; label: string; poolShares: number }[];
  }[];
};

export default function AdminPage() {
  const { data: session } = useSession();
  const [matches, setMatches] = useState<Match[]>([]);

  async function loadMatches() {
    const res = await fetch("/api/matches");
    if (res.ok) setMatches(await res.json());
  }

  useEffect(() => {
    loadMatches();
  }, []);

  async function updateMatchStatus(matchId: string, status: string) {
    await fetch(`/api/matches/${matchId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    loadMatches();
  }

  if (!session) return <p>Please sign in.</p>;

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Admin Panel</h1>

      <CreateMatchForm onCreated={loadMatches} />

      <div className="space-y-6">
        {matches.map((match) => (
          <Card key={match.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>
                  {match.teamA} vs {match.teamB}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{match.status}</Badge>
                  <Select
                    value={match.status}
                    onValueChange={(v) => updateMatchStatus(match.id, v)}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="upcoming">Upcoming</SelectItem>
                      <SelectItem value="live">Live</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {new Date(match.date).toLocaleString()}
              </p>

              {match.markets.map((market) => (
                <div
                  key={market.id}
                  className="border rounded-lg p-4 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{market.question}</span>
                    <div className="flex items-center gap-2">
                      <Badge>{market.status}</Badge>
                      {(market.status === "open" ||
                        market.status === "locked") && (
                        <SettleMarketDialog
                          market={market}
                          onSettled={loadMatches}
                        />
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {market.outcomes.map((o) => (
                      <Badge key={o.id} variant="secondary">
                        {o.label}: {o.poolShares.toFixed(0)} shares
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}

              <CreateMarketForm matchId={match.id} onCreated={loadMatches} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add app/api/matches app/admin/page.tsx components/admin/create-match-form.tsx
git commit -m "feat: add match CRUD API and admin page with match management"
```

---

### Task 6: Market CRUD API + Admin Market Controls

**Files:**
- Create: `app/api/markets/route.ts`
- Create: `app/api/markets/[id]/route.ts`
- Create: `components/admin/create-market-form.tsx`
- Create: `components/admin/settle-market-dialog.tsx`

- [ ] **Step 1: Create markets API — create market**

Create `app/api/markets/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getRequiredAdmin } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    await getRequiredAdmin();
    const body = await request.json();
    const { matchId, question, type, outcomes, initialLiquidity } = body;

    // outcomes is an array of label strings, e.g. ["India", "Australia"]
    const liquidity = initialLiquidity ?? 100;
    const k = Math.pow(liquidity, outcomes.length);

    const market = await prisma.market.create({
      data: {
        matchId,
        question,
        type: type ?? "binary",
        k,
        outcomes: {
          create: outcomes.map((label: string) => ({
            label,
            poolShares: liquidity,
          })),
        },
      },
      include: { outcomes: true },
    });

    return NextResponse.json(market, { status: 201 });
  } catch (e: any) {
    if (e.message === "Forbidden")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
```

- [ ] **Step 2: Create market detail API — get odds, lock, settle, void**

Create `app/api/markets/[id]/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getRequiredSession, getRequiredAdmin } from "@/lib/auth";
import { getPrices, PAYOUT_PER_SHARE } from "@/lib/amm";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await getRequiredSession();
    const { id } = await params;
    const market = await prisma.market.findUniqueOrThrow({
      where: { id },
      include: { outcomes: true },
    });

    const pools = market.outcomes.map((o) => o.poolShares);
    const prices = getPrices(pools);
    const totalVolume = await prisma.transaction.aggregate({
      where: { marketId: id, type: "buy" },
      _sum: { coins: true },
    });

    return NextResponse.json({
      ...market,
      prices: market.outcomes.map((o, i) => ({
        outcomeId: o.id,
        label: o.label,
        price: prices[i],
        poolShares: o.poolShares,
      })),
      totalVolume: totalVolume._sum.coins ?? 0,
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await getRequiredAdmin();
    const { id } = await params;
    const body = await request.json();
    const { action, outcomeId } = body;

    if (action === "lock") {
      const market = await prisma.market.update({
        where: { id },
        data: { status: "locked" },
      });
      return NextResponse.json(market);
    }

    if (action === "settle") {
      return await settleMarket(id, outcomeId);
    }

    if (action === "void") {
      return await voidMarket(id);
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (e: any) {
    if (e.message === "Forbidden")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

async function settleMarket(marketId: string, winningOutcomeId: string) {
  const result = await prisma.$transaction(async (tx) => {
    const market = await tx.market.update({
      where: { id: marketId },
      data: { status: "settled", resolvedOutcome: winningOutcomeId },
    });

    // Find all positions with winning outcome
    const winningPositions = await tx.position.findMany({
      where: { marketId, outcomeId: winningOutcomeId, shares: { gt: 0 } },
    });

    // Pay out each winner
    for (const pos of winningPositions) {
      const payout = pos.shares * PAYOUT_PER_SHARE;
      await tx.user.update({
        where: { id: pos.userId },
        data: { balance: { increment: payout } },
      });
      await tx.transaction.create({
        data: {
          userId: pos.userId,
          marketId,
          outcomeId: winningOutcomeId,
          type: "payout",
          shares: pos.shares,
          coins: payout,
        },
      });
    }

    return market;
  });

  return NextResponse.json(result);
}

async function voidMarket(marketId: string) {
  const result = await prisma.$transaction(async (tx) => {
    const market = await tx.market.update({
      where: { id: marketId },
      data: { status: "voided" },
    });

    // Get all users who have transactions in this market
    const userTotals = await tx.transaction.groupBy({
      by: ["userId"],
      where: { marketId },
      _sum: { coins: true },
    });

    // Refund net spend for each user
    for (const ut of userTotals) {
      const netSpend = ut._sum.coins ?? 0;
      if (netSpend > 0) {
        await tx.user.update({
          where: { id: ut.userId },
          data: { balance: { increment: netSpend } },
        });
        // Find first outcome for the refund transaction record
        const firstOutcome = await tx.outcome.findFirst({
          where: { marketId },
        });
        await tx.transaction.create({
          data: {
            userId: ut.userId,
            marketId,
            outcomeId: firstOutcome!.id,
            type: "refund",
            shares: 0,
            coins: netSpend,
          },
        });
      }
    }

    return market;
  });

  return NextResponse.json(result);
}
```

- [ ] **Step 3: Create market form component**

Create `components/admin/create-market-form.tsx`:

```typescript
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export function CreateMarketForm({
  matchId,
  onCreated,
}: {
  matchId: string;
  onCreated: () => void;
}) {
  const [question, setQuestion] = useState("");
  const [outcomes, setOutcomes] = useState(""); // comma-separated
  const [liquidity, setLiquidity] = useState("100");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const outcomeList = outcomes
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean);
    if (outcomeList.length < 2) {
      toast.error("Need at least 2 outcomes");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/markets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        matchId,
        question,
        type: outcomeList.length === 2 ? "binary" : "multi",
        outcomes: outcomeList,
        initialLiquidity: Number(liquidity),
      }),
    });
    setLoading(false);
    if (res.ok) {
      toast.success("Market created");
      setQuestion("");
      setOutcomes("");
      onCreated();
    } else {
      toast.error("Failed to create market");
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 border-t pt-4 mt-4"
    >
      <Label className="text-sm font-medium">Add Market</Label>
      <Input
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Who will win?"
        required
      />
      <Input
        value={outcomes}
        onChange={(e) => setOutcomes(e.target.value)}
        placeholder="Outcomes (comma-separated): India, Australia"
        required
      />
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <Label className="text-xs">Initial Liquidity</Label>
          <Input
            type="number"
            value={liquidity}
            onChange={(e) => setLiquidity(e.target.value)}
            min="10"
          />
        </div>
        <Button type="submit" size="sm" disabled={loading}>
          {loading ? "Adding..." : "Add Market"}
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 4: Create settle/void dialog**

Create `components/admin/settle-market-dialog.tsx`:

```typescript
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

type Market = {
  id: string;
  question: string;
  status: string;
  outcomes: { id: string; label: string }[];
};

export function SettleMarketDialog({
  market,
  onSettled,
}: {
  market: Market;
  onSettled: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [selectedOutcome, setSelectedOutcome] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleAction(action: "lock" | "settle" | "void") {
    setLoading(true);
    const res = await fetch(`/api/markets/${market.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, outcomeId: selectedOutcome || undefined }),
    });
    setLoading(false);
    if (res.ok) {
      toast.success(
        action === "settle"
          ? "Market settled"
          : action === "void"
            ? "Market voided"
            : "Market locked"
      );
      setOpen(false);
      onSettled();
    } else {
      toast.error("Action failed");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Manage
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{market.question}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {market.status === "open" && (
            <Button
              onClick={() => handleAction("lock")}
              variant="secondary"
              className="w-full"
              disabled={loading}
            >
              Lock Market
            </Button>
          )}
          <div className="space-y-2">
            <Select
              value={selectedOutcome}
              onValueChange={setSelectedOutcome}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select winning outcome" />
              </SelectTrigger>
              <SelectContent>
                {market.outcomes.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={() => handleAction("settle")}
              disabled={!selectedOutcome || loading}
              className="w-full"
            >
              Settle Market
            </Button>
          </div>
          <Button
            onClick={() => handleAction("void")}
            variant="destructive"
            className="w-full"
            disabled={loading}
          >
            Void Market (Refund All)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add app/api/markets components/admin/create-market-form.tsx components/admin/settle-market-dialog.tsx
git commit -m "feat: add market CRUD API with settlement, voiding, and admin controls"
```

---

### Task 7: Trading API

**Files:**
- Create: `app/api/trades/route.ts`

- [ ] **Step 1: Create trades API**

Create `app/api/trades/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getRequiredSession } from "@/lib/auth";
import { getBuyShares, getSellReturn } from "@/lib/amm";

export async function POST(request: Request) {
  try {
    const session = await getRequiredSession();
    const userId = session.user!.id!;
    const body = await request.json();
    const { marketId, outcomeId, action, amount } = body;

    if (action === "buy") {
      return await handleBuy(userId, marketId, outcomeId, amount);
    }
    if (action === "sell") {
      return await handleSell(userId, marketId, outcomeId, amount);
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (e: any) {
    if (e.message === "Unauthorized")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

async function handleBuy(
  userId: string,
  marketId: string,
  outcomeId: string,
  coins: number
) {
  if (coins <= 0)
    return NextResponse.json({ error: "Amount must be positive" }, { status: 400 });

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.balance < coins) {
      throw new Error("Insufficient balance");
    }

    const market = await tx.market.findUniqueOrThrow({
      where: { id: marketId },
      include: { outcomes: true },
    });
    if (market.status !== "open") {
      throw new Error("Market is not open");
    }

    const outcomeIndex = market.outcomes.findIndex((o) => o.id === outcomeId);
    if (outcomeIndex === -1) throw new Error("Invalid outcome");

    const pools = market.outcomes.map((o) => o.poolShares);
    const { shares, newPools } = getBuyShares(pools, outcomeIndex, coins);

    // Update pools
    for (let i = 0; i < market.outcomes.length; i++) {
      await tx.outcome.update({
        where: { id: market.outcomes[i].id },
        data: { poolShares: newPools[i] },
      });
    }

    // Deduct coins
    await tx.user.update({
      where: { id: userId },
      data: { balance: { decrement: coins } },
    });

    // Upsert position
    const existing = await tx.position.findUnique({
      where: {
        userId_marketId_outcomeId: { userId, marketId, outcomeId },
      },
    });

    if (existing) {
      const totalCost = existing.avgPrice * existing.shares + coins;
      const totalShares = existing.shares + shares;
      await tx.position.update({
        where: { id: existing.id },
        data: {
          shares: totalShares,
          avgPrice: totalCost / totalShares,
        },
      });
    } else {
      await tx.position.create({
        data: {
          userId,
          marketId,
          outcomeId,
          shares,
          avgPrice: coins / shares,
        },
      });
    }

    // Record transaction
    await tx.transaction.create({
      data: {
        userId,
        marketId,
        outcomeId,
        type: "buy",
        shares,
        coins,
      },
    });

    return { shares, coins, newPools };
  });

  return NextResponse.json(result);
}

async function handleSell(
  userId: string,
  marketId: string,
  outcomeId: string,
  sharesToSell: number
) {
  if (sharesToSell <= 0)
    return NextResponse.json({ error: "Amount must be positive" }, { status: 400 });

  const result = await prisma.$transaction(async (tx) => {
    const position = await tx.position.findUnique({
      where: {
        userId_marketId_outcomeId: { userId, marketId, outcomeId },
      },
    });
    if (!position || position.shares < sharesToSell) {
      throw new Error("Insufficient shares");
    }

    const market = await tx.market.findUniqueOrThrow({
      where: { id: marketId },
      include: { outcomes: true },
    });
    if (market.status !== "open") {
      throw new Error("Market is not open");
    }

    const outcomeIndex = market.outcomes.findIndex((o) => o.id === outcomeId);
    const pools = market.outcomes.map((o) => o.poolShares);
    const { coinsReturned, newPools } = getSellReturn(
      pools,
      outcomeIndex,
      sharesToSell
    );

    // Update pools
    for (let i = 0; i < market.outcomes.length; i++) {
      await tx.outcome.update({
        where: { id: market.outcomes[i].id },
        data: { poolShares: newPools[i] },
      });
    }

    // Credit coins
    await tx.user.update({
      where: { id: userId },
      data: { balance: { increment: coinsReturned } },
    });

    // Update position
    await tx.position.update({
      where: { id: position.id },
      data: { shares: { decrement: sharesToSell } },
    });

    // Record transaction
    await tx.transaction.create({
      data: {
        userId,
        marketId,
        outcomeId,
        type: "sell",
        shares: sharesToSell,
        coins: coinsReturned,
      },
    });

    return { shares: sharesToSell, coinsReturned, newPools };
  });

  return NextResponse.json(result);
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/trades/route.ts
git commit -m "feat: add trading API with buy/sell, AMM integration, position tracking"
```

---

### Task 8: Home Page — Match Hub

**Files:**
- Create: `components/match-card.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Create match card component**

Create `components/match-card.tsx`:

```typescript
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Match = {
  id: string;
  teamA: string;
  teamB: string;
  date: string;
  status: string;
  markets: { id: string; status: string }[];
};

const statusColors: Record<string, string> = {
  upcoming: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  live: "bg-green-500/10 text-green-500 border-green-500/20",
  completed: "bg-gray-500/10 text-gray-400 border-gray-500/20",
};

export function MatchCard({ match }: { match: Match }) {
  const openMarkets = match.markets.filter((m) => m.status === "open").length;

  return (
    <Link href={`/match/${match.id}`}>
      <Card className="hover:border-primary/50 transition-colors cursor-pointer">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">
              {match.teamA} vs {match.teamB}
            </CardTitle>
            <Badge className={statusColors[match.status] ?? ""} variant="outline">
              {match.status.toUpperCase()}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{new Date(match.date).toLocaleDateString()}</span>
            <span>
              {openMarkets} open market{openMarkets !== 1 ? "s" : ""}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
```

- [ ] **Step 2: Update home page**

Replace `app/page.tsx`:

```typescript
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { MatchCard } from "@/components/match-card";

export default async function HomePage() {
  const session = await auth();

  if (!session) {
    return (
      <div className="text-center py-20">
        <h1 className="text-4xl font-bold mb-4">Match Day Market</h1>
        <p className="text-muted-foreground text-lg">
          Sign in with Google to start predicting cricket match outcomes.
        </p>
      </div>
    );
  }

  const matches = await prisma.match.findMany({
    include: {
      markets: { select: { id: true, status: true } },
    },
    orderBy: [
      { status: "asc" }, // live first, then upcoming, then completed
      { date: "desc" },
    ],
  });

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Matches</h1>
      {matches.length === 0 ? (
        <p className="text-muted-foreground">No matches yet. Check back later!</p>
      ) : (
        <div className="grid gap-4">
          {matches.map((match) => (
            <MatchCard key={match.id} match={match} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add components/match-card.tsx app/page.tsx
git commit -m "feat: add home page with match cards"
```

---

### Task 9: Match Detail Page with Markets & Bet Slip

**Files:**
- Create: `app/match/[id]/page.tsx`
- Create: `components/market-card.tsx`
- Create: `components/bet-slip.tsx`

- [ ] **Step 1: Create market card component**

Create `components/market-card.tsx`:

```typescript
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BetSlip } from "@/components/bet-slip";
import { getPrices } from "@/lib/amm";

type Outcome = {
  id: string;
  label: string;
  poolShares: number;
};

type Market = {
  id: string;
  question: string;
  status: string;
  type: string;
  resolvedOutcome: string | null;
  outcomes: Outcome[];
};

export function MarketCard({
  market,
  onTradeComplete,
}: {
  market: Market;
  onTradeComplete: () => void;
}) {
  const [selectedOutcome, setSelectedOutcome] = useState<string | null>(null);
  const pools = market.outcomes.map((o) => o.poolShares);
  const prices = getPrices(pools);

  const isSettled = market.status === "settled";
  const isOpen = market.status === "open";

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{market.question}</CardTitle>
          <Badge
            variant={
              market.status === "open"
                ? "default"
                : market.status === "locked"
                  ? "secondary"
                  : "outline"
            }
          >
            {market.status.toUpperCase()}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-3">
          {market.outcomes.map((outcome, i) => {
            const isWinner = isSettled && market.resolvedOutcome === outcome.id;
            const pct = (prices[i] * 100).toFixed(0);

            return (
              <button
                key={outcome.id}
                onClick={() =>
                  isOpen
                    ? setSelectedOutcome(
                        selectedOutcome === outcome.id ? null : outcome.id
                      )
                    : undefined
                }
                className={`flex-1 rounded-lg border p-4 text-center transition-colors ${
                  selectedOutcome === outcome.id
                    ? "border-primary bg-primary/10"
                    : isWinner
                      ? "border-green-500 bg-green-500/10"
                      : "border-border hover:border-primary/50"
                } ${isOpen ? "cursor-pointer" : "cursor-default"}`}
              >
                <div className="font-semibold text-lg">{outcome.label}</div>
                <div className="text-3xl font-bold my-1">{pct}%</div>
                <div className="text-xs text-muted-foreground">
                  {prices[i] > 0 ? (prices[i] * 100).toFixed(0) : "0"}{" "}
                  coins/share
                </div>
              </button>
            );
          })}
        </div>

        {selectedOutcome && isOpen && (
          <BetSlip
            marketId={market.id}
            outcomeId={selectedOutcome}
            outcomeLabel={
              market.outcomes.find((o) => o.id === selectedOutcome)?.label ?? ""
            }
            pools={pools}
            outcomeIndex={market.outcomes.findIndex(
              (o) => o.id === selectedOutcome
            )}
            onComplete={() => {
              setSelectedOutcome(null);
              onTradeComplete();
            }}
          />
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Create bet slip component**

Create `components/bet-slip.tsx`:

```typescript
"use client";

import { useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { getBuyShares, PAYOUT_PER_SHARE } from "@/lib/amm";
import { toast } from "sonner";

export function BetSlip({
  marketId,
  outcomeId,
  outcomeLabel,
  pools,
  outcomeIndex,
  onComplete,
}: {
  marketId: string;
  outcomeId: string;
  outcomeLabel: string;
  pools: number[];
  outcomeIndex: number;
  onComplete: () => void;
}) {
  const { data: session } = useSession();
  const balance = (session as any)?.balance ?? 0;
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  const estimate = useMemo(() => {
    const coins = Number(amount);
    if (!coins || coins <= 0) return null;
    const { shares } = getBuyShares(pools, outcomeIndex, coins);
    return {
      shares,
      avgPrice: coins / shares,
      potentialPayout: shares * PAYOUT_PER_SHARE,
    };
  }, [amount, pools, outcomeIndex]);

  async function handleBuy() {
    const coins = Number(amount);
    if (!coins || coins <= 0) return;
    if (coins > balance) {
      toast.error("Insufficient balance");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/trades", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        marketId,
        outcomeId,
        action: "buy",
        amount: coins,
      }),
    });
    setLoading(false);

    if (res.ok) {
      toast.success(`Bought ${estimate?.shares.toFixed(1)} shares of ${outcomeLabel}`);
      onComplete();
    } else {
      const err = await res.json();
      toast.error(err.error ?? "Trade failed");
    }
  }

  return (
    <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Your balance</span>
        <span className="font-medium">{Math.round(balance)} coins</span>
      </div>

      <div>
        <Label htmlFor="bet-amount" className="text-sm">
          Amount (coins)
        </Label>
        <Input
          id="bet-amount"
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="50"
          min="1"
          max={balance}
        />
      </div>

      {estimate && (
        <>
          <Separator />
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Estimated shares</span>
              <span>{estimate.shares.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Avg price/share</span>
              <span>{estimate.avgPrice.toFixed(2)} coins</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Potential payout</span>
              <span className="text-green-500 font-semibold">
                {estimate.potentialPayout.toFixed(0)} coins
              </span>
            </div>
          </div>
        </>
      )}

      <Button onClick={handleBuy} disabled={loading || !estimate} className="w-full">
        {loading ? "Buying..." : `Buy ${outcomeLabel} Shares`}
      </Button>
    </div>
  );
}
```

- [ ] **Step 3: Create match detail page**

Create `app/match/[id]/page.tsx`:

```typescript
"use client";

import { useEffect, useState, use } from "react";
import { Badge } from "@/components/ui/badge";
import { MarketCard } from "@/components/market-card";

type Match = {
  id: string;
  teamA: string;
  teamB: string;
  date: string;
  status: string;
  markets: {
    id: string;
    question: string;
    status: string;
    type: string;
    resolvedOutcome: string | null;
    outcomes: { id: string; label: string; poolShares: number }[];
  }[];
};

export default function MatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [match, setMatch] = useState<Match | null>(null);

  async function loadMatch() {
    const res = await fetch(`/api/matches/${id}`);
    if (res.ok) setMatch(await res.json());
  }

  useEffect(() => {
    loadMatch();
    // Poll every 3s for live odds updates
    const interval = setInterval(loadMatch, 3000);
    return () => clearInterval(interval);
  }, [id]);

  if (!match) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            {match.teamA} vs {match.teamB}
          </h1>
          <p className="text-muted-foreground">
            {new Date(match.date).toLocaleDateString()}
          </p>
        </div>
        <Badge
          className={
            match.status === "live"
              ? "bg-green-500/10 text-green-500 border-green-500/20"
              : ""
          }
          variant="outline"
        >
          {match.status.toUpperCase()}
        </Badge>
      </div>

      {match.markets.length === 0 ? (
        <p className="text-muted-foreground">No markets yet for this match.</p>
      ) : (
        <div className="grid gap-4">
          {match.markets.map((market) => (
            <MarketCard
              key={market.id}
              market={market}
              onTradeComplete={loadMatch}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Verify the page renders**

```bash
cd ~/src/work/match-day-market
npm run dev
```

Navigate to `/match/<some-id>` (create a match via admin first). Verify: markets display with percentage odds, clicking an outcome opens the bet slip.

- [ ] **Step 5: Commit**

```bash
git add app/match components/market-card.tsx components/bet-slip.tsx
git commit -m "feat: add match detail page with market cards and inline bet slip"
```

---

### Task 10: Portfolio Page

**Files:**
- Create: `app/api/portfolio/route.ts`
- Create: `components/position-card.tsx`
- Create: `app/portfolio/page.tsx`

- [ ] **Step 1: Create portfolio API**

Create `app/api/portfolio/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getRequiredSession } from "@/lib/auth";
import { getPrices, PAYOUT_PER_SHARE } from "@/lib/amm";

export async function GET() {
  try {
    const session = await getRequiredSession();
    const userId = session.user!.id!;

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { balance: true },
    });

    const positions = await prisma.position.findMany({
      where: { userId, shares: { gt: 0 } },
      include: {
        market: { include: { outcomes: true } },
        outcome: true,
      },
    });

    const enriched = positions.map((pos) => {
      const pools = pos.market.outcomes.map((o) => o.poolShares);
      const prices = getPrices(pools);
      const outcomeIndex = pos.market.outcomes.findIndex(
        (o) => o.id === pos.outcomeId
      );
      const currentPrice = prices[outcomeIndex];
      const currentValue = pos.shares * currentPrice * PAYOUT_PER_SHARE;
      const costBasis = pos.shares * pos.avgPrice;

      return {
        id: pos.id,
        marketId: pos.marketId,
        question: pos.market.question,
        marketStatus: pos.market.status,
        outcomeLabel: pos.outcome.label,
        outcomeId: pos.outcomeId,
        shares: pos.shares,
        avgPrice: pos.avgPrice,
        currentPrice,
        currentValue,
        costBasis,
        pnl: currentValue - costBasis,
      };
    });

    const transactions = await prisma.transaction.findMany({
      where: { userId },
      include: { outcome: { select: { label: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({
      balance: user.balance,
      positions: enriched,
      transactions,
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
```

- [ ] **Step 2: Create position card**

Create `components/position-card.tsx`:

```typescript
"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type Position = {
  id: string;
  marketId: string;
  question: string;
  marketStatus: string;
  outcomeLabel: string;
  outcomeId: string;
  shares: number;
  avgPrice: number;
  currentPrice: number;
  currentValue: number;
  costBasis: number;
  pnl: number;
};

export function PositionCard({
  position,
  onSold,
}: {
  position: Position;
  onSold: () => void;
}) {
  const [selling, setSelling] = useState(false);
  const [sellAmount, setSellAmount] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSell() {
    const shares = Number(sellAmount);
    if (!shares || shares <= 0 || shares > position.shares) return;

    setLoading(true);
    const res = await fetch("/api/trades", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        marketId: position.marketId,
        outcomeId: position.outcomeId,
        action: "sell",
        amount: shares,
      }),
    });
    setLoading(false);

    if (res.ok) {
      toast.success("Shares sold");
      setSelling(false);
      onSold();
    } else {
      const err = await res.json();
      toast.error(err.error ?? "Sell failed");
    }
  }

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-medium">{position.question}</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary">{position.outcomeLabel}</Badge>
              <span className="text-sm text-muted-foreground">
                {position.shares.toFixed(2)} shares
              </span>
            </div>
          </div>
          <div className="text-right">
            <p className="font-medium">
              {position.currentValue.toFixed(0)} coins
            </p>
            <p
              className={`text-sm ${position.pnl >= 0 ? "text-green-500" : "text-red-500"}`}
            >
              {position.pnl >= 0 ? "+" : ""}
              {position.pnl.toFixed(0)}
            </p>
          </div>
        </div>

        {position.marketStatus === "open" && (
          <div className="mt-3">
            {selling ? (
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={sellAmount}
                  onChange={(e) => setSellAmount(e.target.value)}
                  placeholder={`Max ${position.shares.toFixed(2)}`}
                  min="0.01"
                  max={position.shares}
                  step="0.01"
                />
                <Button size="sm" onClick={handleSell} disabled={loading}>
                  {loading ? "..." : "Confirm"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelling(false)}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSelling(true)}
              >
                Sell
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Create portfolio page**

Create `app/portfolio/page.tsx`:

```typescript
"use client";

import { useEffect, useState } from "react";
import { PositionCard } from "@/components/position-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

type Portfolio = {
  balance: number;
  positions: {
    id: string;
    marketId: string;
    question: string;
    marketStatus: string;
    outcomeLabel: string;
    outcomeId: string;
    shares: number;
    avgPrice: number;
    currentPrice: number;
    currentValue: number;
    costBasis: number;
    pnl: number;
  }[];
  transactions: {
    id: string;
    type: string;
    shares: number;
    coins: number;
    createdAt: string;
    outcome: { label: string };
  }[];
};

export default function PortfolioPage() {
  const [data, setData] = useState<Portfolio | null>(null);

  async function load() {
    const res = await fetch("/api/portfolio");
    if (res.ok) setData(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  if (!data) return <p className="text-muted-foreground">Loading...</p>;

  const totalValue =
    data.balance +
    data.positions.reduce((sum, p) => sum + p.currentValue, 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Portfolio</h1>
        <div className="flex gap-6 mt-2">
          <div>
            <p className="text-sm text-muted-foreground">Cash Balance</p>
            <p className="text-2xl font-bold">
              {Math.round(data.balance)} coins
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Value</p>
            <p className="text-2xl font-bold">
              {Math.round(totalValue)} coins
            </p>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-3">Active Positions</h2>
        {data.positions.length === 0 ? (
          <p className="text-muted-foreground">No active positions.</p>
        ) : (
          <div className="grid gap-3">
            {data.positions.map((pos) => (
              <PositionCard key={pos.id} position={pos} onSold={load} />
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-3">Recent Transactions</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Outcome</TableHead>
              <TableHead className="text-right">Shares</TableHead>
              <TableHead className="text-right">Coins</TableHead>
              <TableHead className="text-right">Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.transactions.map((tx) => (
              <TableRow key={tx.id}>
                <TableCell>
                  <Badge variant="outline">{tx.type}</Badge>
                </TableCell>
                <TableCell>{tx.outcome.label}</TableCell>
                <TableCell className="text-right">
                  {tx.shares.toFixed(2)}
                </TableCell>
                <TableCell className="text-right">
                  {tx.coins.toFixed(0)}
                </TableCell>
                <TableCell className="text-right">
                  {new Date(tx.createdAt).toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add app/api/portfolio app/portfolio components/position-card.tsx
git commit -m "feat: add portfolio page with positions, sell flow, and transaction history"
```

---

### Task 11: Leaderboard Page

**Files:**
- Create: `app/api/leaderboard/route.ts`
- Create: `app/leaderboard/page.tsx`

- [ ] **Step 1: Create leaderboard API**

Create `app/api/leaderboard/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getRequiredSession } from "@/lib/auth";
import { getPrices, PAYOUT_PER_SHARE } from "@/lib/amm";

export async function GET() {
  try {
    await getRequiredSession();

    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        image: true,
        balance: true,
        positions: {
          where: { shares: { gt: 0 } },
          include: {
            market: { include: { outcomes: true } },
          },
        },
      },
    });

    const leaderboard = users
      .map((user) => {
        let positionValue = 0;
        let activePositions = 0;

        for (const pos of user.positions) {
          const pools = pos.market.outcomes.map((o) => o.poolShares);
          const prices = getPrices(pools);
          const idx = pos.market.outcomes.findIndex(
            (o) => o.id === pos.outcomeId
          );
          positionValue += pos.shares * prices[idx] * PAYOUT_PER_SHARE;
          activePositions++;
        }

        return {
          id: user.id,
          name: user.name ?? "Anonymous",
          image: user.image,
          balance: user.balance,
          positionValue,
          totalValue: user.balance + positionValue,
          activePositions,
        };
      })
      .sort((a, b) => b.totalValue - a.totalValue);

    return NextResponse.json(leaderboard);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
```

- [ ] **Step 2: Create leaderboard page**

Create `app/leaderboard/page.tsx`:

```typescript
"use client";

import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Player = {
  id: string;
  name: string;
  image: string | null;
  balance: number;
  positionValue: number;
  totalValue: number;
  activePositions: number;
};

export default function LeaderboardPage() {
  const [players, setPlayers] = useState<Player[]>([]);

  async function load() {
    const res = await fetch("/api/leaderboard");
    if (res.ok) setPlayers(await res.json());
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Leaderboard</h1>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">#</TableHead>
            <TableHead>Player</TableHead>
            <TableHead className="text-right">Cash</TableHead>
            <TableHead className="text-right">Positions</TableHead>
            <TableHead className="text-right">Total Value</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {players.map((player, i) => (
            <TableRow key={player.id}>
              <TableCell className="font-bold text-lg">
                {i === 0 ? "1st" : i === 1 ? "2nd" : i === 2 ? "3rd" : `${i + 1}`}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={player.image ?? ""} />
                    <AvatarFallback>{player.name[0]}</AvatarFallback>
                  </Avatar>
                  <span className="font-medium">{player.name}</span>
                </div>
              </TableCell>
              <TableCell className="text-right">
                {Math.round(player.balance)}
              </TableCell>
              <TableCell className="text-right">
                {player.activePositions}
              </TableCell>
              <TableCell className="text-right font-bold">
                {Math.round(player.totalValue)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/leaderboard app/leaderboard
git commit -m "feat: add leaderboard page with portfolio-value rankings and live polling"
```

---

### Task 12: Admin User Management

**Files:**
- Create: `app/admin/users/page.tsx`

- [ ] **Step 1: Create admin users page**

Create `app/admin/users/page.tsx`:

```typescript
"use client";

import { useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type User = {
  id: string;
  name: string | null;
  email: string;
  balance: number;
  createdAt: string;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [adjustAmounts, setAdjustAmounts] = useState<Record<string, string>>(
    {}
  );

  async function loadUsers() {
    const res = await fetch("/api/admin/users");
    if (res.ok) setUsers(await res.json());
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function adjustBalance(userId: string) {
    const amount = Number(adjustAmounts[userId]);
    if (!amount) return;

    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, amount }),
    });

    if (res.ok) {
      toast.success(`Balance adjusted by ${amount}`);
      setAdjustAmounts((prev) => ({ ...prev, [userId]: "" }));
      loadUsers();
    } else {
      toast.error("Failed to adjust balance");
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">User Management</h1>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead className="text-right">Balance</TableHead>
            <TableHead>Joined</TableHead>
            <TableHead>Adjust Balance</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell>{user.name ?? "—"}</TableCell>
              <TableCell>{user.email}</TableCell>
              <TableCell className="text-right">
                {Math.round(user.balance)}
              </TableCell>
              <TableCell>
                {new Date(user.createdAt).toLocaleDateString()}
              </TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={adjustAmounts[user.id] ?? ""}
                    onChange={(e) =>
                      setAdjustAmounts((prev) => ({
                        ...prev,
                        [user.id]: e.target.value,
                      }))
                    }
                    placeholder="+100 or -50"
                    className="w-28"
                  />
                  <Button
                    size="sm"
                    onClick={() => adjustBalance(user.id)}
                  >
                    Apply
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

- [ ] **Step 2: Create admin users API**

Create `app/api/admin/users/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getRequiredAdmin } from "@/lib/auth";

export async function GET() {
  try {
    await getRequiredAdmin();
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        balance: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(users);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
}

export async function PATCH(request: Request) {
  try {
    await getRequiredAdmin();
    const { userId, amount } = await request.json();

    const user = await prisma.user.update({
      where: { id: userId },
      data: { balance: { increment: amount } },
    });

    return NextResponse.json(user);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add app/admin/users app/api/admin
git commit -m "feat: add admin user management with balance adjustment"
```

---

### Task 13: End-to-End Smoke Test

**Files:** None new — manual verification of the full flow.

- [ ] **Step 1: Start the dev server**

```bash
cd ~/src/work/match-day-market
npm run dev
```

- [ ] **Step 2: Test the full flow manually**

1. Visit `http://localhost:3000` — sign in with Google
2. Navigate to `/admin` — create a match (e.g., India vs Australia)
3. Add a market: "Who will win?" with outcomes "India, Australia" and liquidity 100
4. Set match status to "Live"
5. Go to home page — verify match card appears
6. Click into match — verify market shows 50/50 odds
7. Click "India" — bet 50 coins
8. Verify odds shifted (India > 50%)
9. Check `/portfolio` — position shows with P&L
10. Check `/leaderboard` — your ranking appears
11. Go to `/admin` — lock the market, then settle with "India" as winner
12. Check `/portfolio` — payout credited
13. Check balance updated in nav

- [ ] **Step 3: Run unit tests**

```bash
cd ~/src/work/match-day-market
npx vitest run
```

Expected: all AMM tests pass.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: final cleanup and verification"
```

---

## Task Dependency Summary

```
Task 1 (scaffold) → Task 2 (DB) → Task 3 (AMM) → Task 4 (auth)
                                                         ↓
Task 5 (match API) → Task 6 (market API) → Task 7 (trades API)
                                                         ↓
Task 8 (home) → Task 9 (match detail + bet slip) → Task 10 (portfolio)
                                                         ↓
                                          Task 11 (leaderboard) → Task 12 (admin users)
                                                                        ↓
                                                                  Task 13 (smoke test)
```

Tasks 3 (AMM) and 4 (auth) can be parallelized after Task 2. Tasks 8-12 are the UI layer and depend on the API tasks being complete.
