import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getRequiredAdmin } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    await getRequiredAdmin();
    const body = await request.json();
    const { matchId, question, type, outcomes, initialLiquidity } = body;

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
