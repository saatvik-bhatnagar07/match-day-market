"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BetSlip } from "@/components/bet-slip";
import { getPrices } from "@/lib/amm";

type Outcome = {
  id: string;
  label: string;
  poolShares: number;
};

type Market = {
  id: string;
  question: string;
  status: string;
  type: string;
  resolvedOutcome: string | null;
  outcomes: Outcome[];
};

export function MarketCard({
  market,
  onTradeComplete,
}: {
  market: Market;
  onTradeComplete: () => void;
}) {
  const [selectedOutcome, setSelectedOutcome] = useState<string | null>(null);
  const pools = market.outcomes.map((o) => o.poolShares);
  const prices = getPrices(pools);

  const isSettled = market.status === "settled";
  const isOpen = market.status === "open";

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{market.question}</CardTitle>
          <Badge
            variant={
              market.status === "open"
                ? "default"
                : market.status === "locked"
                  ? "secondary"
                  : "outline"
            }
          >
            {market.status.toUpperCase()}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-3">
          {market.outcomes.map((outcome, i) => {
            const isWinner = isSettled && market.resolvedOutcome === outcome.id;
            const pct = (prices[i] * 100).toFixed(0);

            return (
              <button
                key={outcome.id}
                onClick={() =>
                  isOpen
                    ? setSelectedOutcome(
                        selectedOutcome === outcome.id ? null : outcome.id
                      )
                    : undefined
                }
                className={`flex-1 rounded-lg border p-4 text-center transition-colors ${
                  selectedOutcome === outcome.id
                    ? "border-primary bg-primary/10"
                    : isWinner
                      ? "border-green-500 bg-green-500/10"
                      : "border-border hover:border-primary/50"
                } ${isOpen ? "cursor-pointer" : "cursor-default"}`}
              >
                <div className="font-semibold text-lg">{outcome.label}</div>
                <div className="text-3xl font-bold my-1">{pct}%</div>
                <div className="text-xs text-muted-foreground">
                  {prices[i] > 0 ? (prices[i] * 100).toFixed(0) : "0"} coins/share
                </div>
              </button>
            );
          })}
        </div>

        {selectedOutcome && isOpen && (
          <BetSlip
            marketId={market.id}
            outcomeId={selectedOutcome}
            outcomeLabel={
              market.outcomes.find((o) => o.id === selectedOutcome)?.label ?? ""
            }
            pools={pools}
            outcomeIndex={market.outcomes.findIndex(
              (o) => o.id === selectedOutcome
            )}
            onComplete={() => {
              setSelectedOutcome(null);
              onTradeComplete();
            }}
          />
        )}
      </CardContent>
    </Card>
  );
}
