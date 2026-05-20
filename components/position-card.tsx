"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type Position = {
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
};

export function PositionCard({
  position,
  onSold,
}: {
  position: Position;
  onSold: () => void;
}) {
  const [selling, setSelling] = useState(false);
  const [sellAmount, setSellAmount] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSell() {
    const shares = Number(sellAmount);
    if (!shares || shares <= 0 || shares > position.shares) return;

    setLoading(true);
    const res = await fetch("/api/trades", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        marketId: position.marketId,
        outcomeId: position.outcomeId,
        action: "sell",
        amount: shares,
      }),
    });
    setLoading(false);

    if (res.ok) {
      toast.success("Shares sold");
      setSelling(false);
      onSold();
    } else {
      const err = await res.json();
      toast.error(err.error ?? "Sell failed");
    }
  }

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-medium">{position.question}</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary">{position.outcomeLabel}</Badge>
              <span className="text-sm text-muted-foreground">
                {position.shares.toFixed(2)} shares
              </span>
            </div>
          </div>
          <div className="text-right">
            <p className="font-medium">
              {position.currentValue.toFixed(0)} coins
            </p>
            <p className={`text-sm ${position.pnl >= 0 ? "text-green-500" : "text-red-500"}`}>
              {position.pnl >= 0 ? "+" : ""}{position.pnl.toFixed(0)}
            </p>
          </div>
        </div>

        {position.marketStatus === "open" && (
          <div className="mt-3">
            {selling ? (
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={sellAmount}
                  onChange={(e) => setSellAmount(e.target.value)}
                  placeholder={`Max ${position.shares.toFixed(2)}`}
                  min="0.01"
                  max={position.shares}
                  step="0.01"
                />
                <Button size="sm" onClick={handleSell} disabled={loading}>
                  {loading ? "..." : "Confirm"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelling(false)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setSelling(true)}>
                Sell
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
