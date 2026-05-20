"use client";

import Link from "next/link";
import { useSession, signIn, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Nav() {
  const { data: session } = useSession();

  return (
    <nav className="border-b">
      <div className="container mx-auto px-4 max-w-5xl flex items-center justify-between h-14">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-bold text-lg">
            Match Day Market
          </Link>
          {session && (
            <>
              <Link
                href="/portfolio"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Portfolio
              </Link>
              <Link
                href="/leaderboard"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Leaderboard
              </Link>
            </>
          )}
        </div>
        <div className="flex items-center gap-4">
          {session ? (
            <>
              <span className="text-sm font-medium">
                {Math.round((session as any).balance ?? 0)} coins
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger>
                  <Avatar className="h-8 w-8 cursor-pointer">
                    <AvatarImage src={session.user?.image ?? ""} />
                    <AvatarFallback>
                      {session.user?.name?.[0] ?? "?"}
                    </AvatarFallback>
                  </Avatar>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>
                    <Link href="/admin">Admin</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => signOut()}>
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Button onClick={() => signIn("google")} size="sm">
              Sign in with Google
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
}
