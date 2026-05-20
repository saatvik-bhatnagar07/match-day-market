"use client";

import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Player = {
  id: string;
  name: string;
  image: string | null;
  balance: number;
  positionValue: number;
  totalValue: number;
  activePositions: number;
};

export default function LeaderboardPage() {
  const [players, setPlayers] = useState<Player[]>([]);

  async function load() {
    const res = await fetch("/api/leaderboard");
    if (res.ok) setPlayers(await res.json());
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Leaderboard</h1>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">#</TableHead>
            <TableHead>Player</TableHead>
            <TableHead className="text-right">Cash</TableHead>
            <TableHead className="text-right">Positions</TableHead>
            <TableHead className="text-right">Total Value</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {players.map((player, i) => (
            <TableRow key={player.id}>
              <TableCell className="font-bold text-lg">
                {i === 0
                  ? "1st"
                  : i === 1
                    ? "2nd"
                    : i === 2
                      ? "3rd"
                      : `${i + 1}`}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={player.image ?? ""} />
                    <AvatarFallback>{player.name[0]}</AvatarFallback>
                  </Avatar>
                  <span className="font-medium">{player.name}</span>
                </div>
              </TableCell>
              <TableCell className="text-right">
                {Math.round(player.balance)}
              </TableCell>
              <TableCell className="text-right">
                {player.activePositions}
              </TableCell>
              <TableCell className="text-right font-bold">
                {Math.round(player.totalValue)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
