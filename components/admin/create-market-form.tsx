"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export function CreateMarketForm({
  matchId,
  onCreated,
}: {
  matchId: string;
  onCreated: () => void;
}) {
  const [question, setQuestion] = useState("");
  const [outcomes, setOutcomes] = useState("");
  const [liquidity, setLiquidity] = useState("100");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const outcomeList = outcomes
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean);
    if (outcomeList.length < 2) {
      toast.error("Need at least 2 outcomes");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/markets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        matchId,
        question,
        type: outcomeList.length === 2 ? "binary" : "multi",
        outcomes: outcomeList,
        initialLiquidity: Number(liquidity),
      }),
    });
    setLoading(false);
    if (res.ok) {
      toast.success("Market created");
      setQuestion("");
      setOutcomes("");
      onCreated();
    } else {
      toast.error("Failed to create market");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 border-t pt-4 mt-4">
      <Label className="text-sm font-medium">Add Market</Label>
      <Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Who will win?" required />
      <Input value={outcomes} onChange={(e) => setOutcomes(e.target.value)} placeholder="Outcomes (comma-separated): India, Australia" required />
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <Label className="text-xs">Initial Liquidity</Label>
          <Input type="number" value={liquidity} onChange={(e) => setLiquidity(e.target.value)} min="10" />
        </div>
        <Button type="submit" size="sm" disabled={loading}>
          {loading ? "Adding..." : "Add Market"}
        </Button>
      </div>
    </form>
  );
}
