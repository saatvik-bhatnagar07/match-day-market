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
