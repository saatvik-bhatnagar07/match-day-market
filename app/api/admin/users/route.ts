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
