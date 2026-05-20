"use client";

import { useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type User = {
  id: string;
  name: string | null;
  email: string;
  balance: number;
  createdAt: string;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [adjustAmounts, setAdjustAmounts] = useState<Record<string, string>>(
    {}
  );

  async function loadUsers() {
    const res = await fetch("/api/admin/users");
    if (res.ok) setUsers(await res.json());
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function adjustBalance(userId: string) {
    const amount = Number(adjustAmounts[userId]);
    if (!amount) return;

    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, amount }),
    });

    if (res.ok) {
      toast.success(`Balance adjusted by ${amount}`);
      setAdjustAmounts((prev) => ({ ...prev, [userId]: "" }));
      loadUsers();
    } else {
      toast.error("Failed to adjust balance");
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">User Management</h1>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead className="text-right">Balance</TableHead>
            <TableHead>Joined</TableHead>
            <TableHead>Adjust Balance</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell>{user.name ?? "\u2014"}</TableCell>
              <TableCell>{user.email}</TableCell>
              <TableCell className="text-right">
                {Math.round(user.balance)}
              </TableCell>
              <TableCell>
                {new Date(user.createdAt).toLocaleDateString()}
              </TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={adjustAmounts[user.id] ?? ""}
                    onChange={(e) =>
                      setAdjustAmounts((prev) => ({
                        ...prev,
                        [user.id]: e.target.value,
                      }))
                    }
                    placeholder="+100 or -50"
                    className="w-28"
                  />
                  <Button size="sm" onClick={() => adjustBalance(user.id)}>
                    Apply
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
