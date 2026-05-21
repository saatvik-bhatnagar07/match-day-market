import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getRequiredSession, getRequiredAdmin } from "@/lib/auth";

export async function GET() {
  try {
    await getRequiredSession();
    const matches = await prisma.match.findMany({
      include: {
        markets: {
          include: { outcomes: true },
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
