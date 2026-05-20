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
