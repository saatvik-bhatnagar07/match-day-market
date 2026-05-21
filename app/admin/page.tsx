"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { CreateMatchForm } from "@/components/admin/create-match-form";
import { CreateMarketForm } from "@/components/admin/create-market-form";
import { SettleMarketDialog } from "@/components/admin/settle-market-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
    outcomes: { id: string; label: string; poolShares: number }[];
  }[];
};

export default function AdminPage() {
  const { data: session } = useSession();
  const [matches, setMatches] = useState<Match[]>([]);

  async function loadMatches() {
    const res = await fetch("/api/matches");
    if (res.ok) setMatches(await res.json());
  }

  useEffect(() => {
    loadMatches();
  }, []);

  async function updateMatchStatus(matchId: string, status: string) {
    await fetch(`/api/matches/${matchId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    loadMatches();
  }

  if (!session) return <p>Please sign in.</p>;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Admin Panel</h1>
        <Link href="/admin/users">
          <Button variant="outline">Manage Users</Button>
        </Link>
      </div>
      <CreateMatchForm onCreated={loadMatches} />
      <div className="space-y-6">
        {matches.map((match) => (
          <Card key={match.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>
                  {match.teamA} vs {match.teamB}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{match.status}</Badge>
                  <Select
                    value={match.status}
                    onValueChange={(v) => v && updateMatchStatus(match.id, v)}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="upcoming">Upcoming</SelectItem>
                      <SelectItem value="live">Live</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {new Date(match.date).toLocaleString()}
              </p>
              {match.markets.map((market) => (
                <div
                  key={market.id}
                  className="border rounded-lg p-4 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{market.question}</span>
                    <div className="flex items-center gap-2">
                      <Badge>{market.status}</Badge>
                      {(market.status === "open" || market.status === "locked") && (
                        <SettleMarketDialog market={market} onSettled={loadMatches} />
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {market.outcomes.map((o) => (
                      <Badge key={o.id} variant="secondary">
                        {o.label}: {o.poolShares.toFixed(0)} shares
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
              <CreateMarketForm matchId={match.id} onCreated={loadMatches} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
