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
    return NextResponse.json(
      { error: "Amount must be positive" },
      { status: 400 }
    );

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
    return NextResponse.json(
      { error: "Amount must be positive" },
      { status: 400 }
    );

  const result = await prisma.$transaction(async (tx) => {
    const position = await tx.position.findUnique({
      where: {
        userId_marketId_outcomeId: { userId, marketId, outcomeId },
      },
    });
    if (!position || position.shares < sharesToSell - 0.001) {
      throw new Error("Insufficient shares");
    }

    // Snap to actual shares if selling approximately all
    if (Math.abs(sharesToSell - position.shares) < 0.01) {
      sharesToSell = position.shares;
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
