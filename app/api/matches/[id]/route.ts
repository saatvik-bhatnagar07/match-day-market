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
