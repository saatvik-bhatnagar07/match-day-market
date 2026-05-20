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

    const winningPositions = await tx.position.findMany({
      where: { marketId, outcomeId: winningOutcomeId, shares: { gt: 0 } },
    });

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

    const userTotals = await tx.transaction.groupBy({
      by: ["userId"],
      where: { marketId },
      _sum: { coins: true },
    });

    for (const ut of userTotals) {
      const netSpend = ut._sum.coins ?? 0;
      if (netSpend > 0) {
        await tx.user.update({
          where: { id: ut.userId },
          data: { balance: { increment: netSpend } },
        });
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
