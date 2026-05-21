import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getRequiredSession } from "@/lib/auth";
import { getSellReturn } from "@/lib/amm";

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
          const idx = pos.market.outcomes.findIndex(
            (o) => o.id === pos.outcomeId
          );
          const { coinsReturned } = getSellReturn(pools, idx, pos.shares);
          positionValue += coinsReturned;
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
