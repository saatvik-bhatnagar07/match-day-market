"use client";

import { useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { getBuyShares, PAYOUT_PER_SHARE } from "@/lib/amm";
import { toast } from "sonner";

export function BetSlip({
  marketId,
  outcomeId,
  outcomeLabel,
  pools,
  outcomeIndex,
  onComplete,
}: {
  marketId: string;
  outcomeId: string;
  outcomeLabel: string;
  pools: number[];
  outcomeIndex: number;
  onComplete: () => void;
}) {
  const { data: session } = useSession();
  const balance = (session as any)?.balance ?? 0;
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  const estimate = useMemo(() => {
    const coins = Number(amount);
    if (!coins || coins <= 0) return null;
    const { shares } = getBuyShares(pools, outcomeIndex, coins);
    return {
      shares,
      avgPrice: coins / shares,
      potentialPayout: shares * PAYOUT_PER_SHARE,
    };
  }, [amount, pools, outcomeIndex]);

  async function handleBuy() {
    const coins = Number(amount);
    if (!coins || coins <= 0) return;
    if (coins > balance) {
      toast.error("Insufficient balance");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/trades", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        marketId,
        outcomeId,
        action: "buy",
        amount: coins,
      }),
    });
    setLoading(false);

    if (res.ok) {
      toast.success(`Bought ${estimate?.shares.toFixed(1)} shares of ${outcomeLabel}`);
      onComplete();
    } else {
      const err = await res.json();
      toast.error(err.error ?? "Trade failed");
    }
  }

  return (
    <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Your balance</span>
        <span className="font-medium">{Math.round(balance)} coins</span>
      </div>

      <div>
        <Label htmlFor="bet-amount" className="text-sm">
          Amount (coins)
        </Label>
        <Input
          id="bet-amount"
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="50"
          min="1"
          max={balance}
        />
      </div>

      {estimate && (
        <>
          <Separator />
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Estimated shares</span>
              <span>{estimate.shares.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Avg price/share</span>
              <span>{estimate.avgPrice.toFixed(2)} coins</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Potential payout</span>
              <span className="text-green-500 font-semibold">
                {estimate.potentialPayout.toFixed(0)} coins
              </span>
            </div>
          </div>
        </>
      )}

      <Button onClick={handleBuy} disabled={loading || !estimate} className="w-full">
        {loading ? "Buying..." : `Buy ${outcomeLabel} Shares`}
      </Button>
    </div>
  );
}
