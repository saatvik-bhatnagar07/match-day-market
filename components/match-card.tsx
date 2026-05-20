import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Match = {
  id: string;
  teamA: string;
  teamB: string;
  date: string;
  status: string;
  markets: { id: string; status: string }[];
};

const statusColors: Record<string, string> = {
  upcoming: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  live: "bg-green-500/10 text-green-500 border-green-500/20",
  completed: "bg-gray-500/10 text-gray-400 border-gray-500/20",
};

export function MatchCard({ match }: { match: Match }) {
  const openMarkets = match.markets.filter((m) => m.status === "open").length;

  return (
    <Link href={`/match/${match.id}`}>
      <Card className="hover:border-primary/50 transition-colors cursor-pointer">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">
              {match.teamA} vs {match.teamB}
            </CardTitle>
            <Badge className={statusColors[match.status] ?? ""} variant="outline">
              {match.status.toUpperCase()}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{new Date(match.date).toLocaleDateString()}</span>
            <span>
              {openMarkets} open market{openMarkets !== 1 ? "s" : ""}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
