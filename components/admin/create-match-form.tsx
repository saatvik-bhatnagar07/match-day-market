"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export function CreateMatchForm({ onCreated }: { onCreated: () => void }) {
  const [teamA, setTeamA] = useState("");
  const [teamB, setTeamB] = useState("");
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/matches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamA, teamB, date }),
    });
    setLoading(false);
    if (res.ok) {
      toast.success("Match created");
      setTeamA("");
      setTeamB("");
      setDate("");
      onCreated();
    } else {
      toast.error("Failed to create match");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Match</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="teamA">Team A</Label>
              <Input
                id="teamA"
                value={teamA}
                onChange={(e) => setTeamA(e.target.value)}
                placeholder="India"
                required
              />
            </div>
            <div>
              <Label htmlFor="teamB">Team B</Label>
              <Input
                id="teamB"
                value={teamB}
                onChange={(e) => setTeamB(e.target.value)}
                placeholder="Australia"
                required
              />
            </div>
          </div>
          <div>
            <Label htmlFor="date">Match Date</Label>
            <Input
              id="date"
              type="datetime-local"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? "Creating..." : "Create Match"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
