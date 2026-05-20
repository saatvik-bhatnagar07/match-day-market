import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? "file:./dev.db",
  }),
});

async function main() {
  // Create a match
  const match = await prisma.match.create({
    data: {
      teamA: "India",
      teamB: "Australia",
      date: new Date("2026-05-25T14:00:00Z"),
      status: "upcoming",
    },
  });
  console.log(`Created match: ${match.teamA} vs ${match.teamB}`);

  // Market 1: Match winner (binary)
  const liquidity1 = 200;
  const winnerMarket = await prisma.market.create({
    data: {
      matchId: match.id,
      question: "Who will win the match?",
      type: "binary",
      k: Math.pow(liquidity1, 2),
      outcomes: {
        create: [
          { label: "India", poolShares: liquidity1 },
          { label: "Australia", poolShares: liquidity1 },
        ],
      },
    },
    include: { outcomes: true },
  });
  console.log(`Created market: ${winnerMarket.question}`);

  // Market 2: Top scorer (multi-outcome)
  const liquidity2 = 150;
  const topScorerMarket = await prisma.market.create({
    data: {
      matchId: match.id,
      question: "Who will be the top scorer?",
      type: "multi",
      k: Math.pow(liquidity2, 4),
      outcomes: {
        create: [
          { label: "Virat Kohli", poolShares: liquidity2 },
          { label: "Steve Smith", poolShares: liquidity2 },
          { label: "Rohit Sharma", poolShares: liquidity2 },
          { label: "Other", poolShares: liquidity2 },
        ],
      },
    },
    include: { outcomes: true },
  });
  console.log(`Created market: ${topScorerMarket.question}`);

  // Market 3: Total runs (binary)
  const liquidity3 = 200;
  const runsMarket = await prisma.market.create({
    data: {
      matchId: match.id,
      question: "Will total runs exceed 300?",
      type: "binary",
      k: Math.pow(liquidity3, 2),
      outcomes: {
        create: [
          { label: "Over 300", poolShares: liquidity3 },
          { label: "Under 300", poolShares: liquidity3 },
        ],
      },
    },
    include: { outcomes: true },
  });
  console.log(`Created market: ${runsMarket.question}`);

  // Market 4: First wicket (binary)
  const liquidity4 = 150;
  const wicketMarket = await prisma.market.create({
    data: {
      matchId: match.id,
      question: "Will the first wicket fall in the first 5 overs?",
      type: "binary",
      k: Math.pow(liquidity4, 2),
      outcomes: {
        create: [
          { label: "Yes", poolShares: liquidity4 },
          { label: "No", poolShares: liquidity4 },
        ],
      },
    },
    include: { outcomes: true },
  });
  console.log(`Created market: ${wicketMarket.question}`);

  console.log("\nSeed complete! 1 match with 4 markets created.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
