"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

type Market = {
  id: string;
  question: string;
  status: string;
  outcomes: { id: string; label: string }[];
};

export function SettleMarketDialog({
  market,
  onSettled,
}: {
  market: Market;
  onSettled: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [selectedOutcome, setSelectedOutcome] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleAction(action: "lock" | "settle" | "void") {
    setLoading(true);
    const res = await fetch(`/api/markets/${market.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, outcomeId: selectedOutcome || undefined }),
    });
    setLoading(false);
    if (res.ok) {
      toast.success(
        action === "settle" ? "Market settled" : action === "void" ? "Market voided" : "Market locked"
      );
      setOpen(false);
      onSettled();
    } else {
      toast.error("Action failed");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => setOpen(isOpen)}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        Manage
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{market.question}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {market.status === "open" && (
            <Button onClick={() => handleAction("lock")} variant="secondary" className="w-full" disabled={loading}>
              Lock Market
            </Button>
          )}
          <div className="space-y-2">
            <Select value={selectedOutcome} onValueChange={setSelectedOutcome}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select winning outcome" />
              </SelectTrigger>
              <SelectContent>
                {market.outcomes.map((o) => (
                  <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => handleAction("settle")} disabled={!selectedOutcome || loading} className="w-full">
              Settle Market
            </Button>
          </div>
          <Button onClick={() => handleAction("void")} variant="destructive" className="w-full" disabled={loading}>
            Void Market (Refund All)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
