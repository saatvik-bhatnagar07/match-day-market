"use client";

import { useEffect, useState } from "react";
import { PositionCard } from "@/components/position-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

type Portfolio = {
  balance: number;
  positions: {
    id: string;
    marketId: string;
    question: string;
    marketStatus: string;
    outcomeLabel: string;
    outcomeId: string;
    shares: number;
    avgPrice: number;
    currentPrice: number;
    currentValue: number;
    costBasis: number;
    pnl: number;
  }[];
  transactions: {
    id: string;
    type: string;
    shares: number;
    coins: number;
    createdAt: string;
    outcome: { label: string };
  }[];
};

export default function PortfolioPage() {
  const [data, setData] = useState<Portfolio | null>(null);

  async function load() {
    const res = await fetch("/api/portfolio");
    if (res.ok) setData(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  if (!data) return <p className="text-muted-foreground">Loading...</p>;

  const totalValue =
    data.balance +
    data.positions.reduce((sum, p) => sum + p.currentValue, 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Portfolio</h1>
        <div className="flex gap-6 mt-2">
          <div>
            <p className="text-sm text-muted-foreground">Cash Balance</p>
            <p className="text-2xl font-bold">{Math.round(data.balance)} coins</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Value</p>
            <p className="text-2xl font-bold">{Math.round(totalValue)} coins</p>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-3">Active Positions</h2>
        {data.positions.length === 0 ? (
          <p className="text-muted-foreground">No active positions.</p>
        ) : (
          <div className="grid gap-3">
            {data.positions.map((pos) => (
              <PositionCard key={pos.id} position={pos} onSold={load} />
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-3">Recent Transactions</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Outcome</TableHead>
              <TableHead className="text-right">Shares</TableHead>
              <TableHead className="text-right">Coins</TableHead>
              <TableHead className="text-right">Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.transactions.map((tx) => (
              <TableRow key={tx.id}>
                <TableCell><Badge variant="outline">{tx.type}</Badge></TableCell>
                <TableCell>{tx.outcome.label}</TableCell>
                <TableCell className="text-right">{tx.shares.toFixed(2)}</TableCell>
                <TableCell className="text-right">{tx.coins.toFixed(0)}</TableCell>
                <TableCell className="text-right">{new Date(tx.createdAt).toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
