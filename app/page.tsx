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
      { status: "asc" },
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
