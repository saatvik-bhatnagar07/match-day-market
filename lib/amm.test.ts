import { describe, it, expect } from "vitest";
import {
  getPrice,
  getBuyShares,
  getBuyCost,
  getSellReturn,
  getPrices,
} from "./amm";

describe("AMM - binary market pricing", () => {
  it("returns 50/50 odds for equal pools", () => {
    const prices = getPrices([100, 100]);
    expect(prices[0]).toBeCloseTo(0.5);
    expect(prices[1]).toBeCloseTo(0.5);
  });

  it("prices sum to 1", () => {
    const prices = getPrices([80, 120]);
    const sum = prices.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1);
  });

  it("higher pool means lower price for that outcome", () => {
    const prices = getPrices([150, 50]);
    expect(prices[0]).toBeLessThan(prices[1]);
  });
});

describe("AMM - buying shares", () => {
  it("returns correct shares for a buy", () => {
    // pools: [100, 100], k = 10000
    // buy 10 coins of outcome 0
    // newPool1 = 100 + 10 = 110, newPool0 = 10000/110 = 90.909
    // shares = 100 - 90.909 = 9.09
    const result = getBuyShares([100, 100], 0, 10);
    expect(result.shares).toBeCloseTo(9.0909, 2);
    expect(result.newPools[0]).toBeCloseTo(90.9091, 2);
    expect(result.newPools[1]).toBeCloseTo(110, 2);
  });

  it("buying shifts price up for that outcome", () => {
    const result = getBuyShares([100, 100], 0, 50);
    const newPrices = getPrices(result.newPools);
    expect(newPrices[0]).toBeGreaterThan(0.5);
  });

  it("preserves k invariant", () => {
    const pools = [100, 100];
    const k = pools[0] * pools[1];
    const result = getBuyShares(pools, 0, 30);
    const newK = result.newPools[0] * result.newPools[1];
    expect(newK).toBeCloseTo(k, 4);
  });
});

describe("AMM - selling shares", () => {
  it("returns correct coins for a sell", () => {
    // First buy some shares
    const buyResult = getBuyShares([100, 100], 0, 50);
    // Then sell them back
    const sellResult = getSellReturn(buyResult.newPools, 0, buyResult.shares);
    // Should get back approximately 50 coins (minus slippage from round-trip)
    expect(sellResult.coinsReturned).toBeCloseTo(50, 0);
  });

  it("preserves k invariant on sell", () => {
    const pools = [80, 120];
    const k = pools[0] * pools[1];
    const sellResult = getSellReturn(pools, 0, 5);
    const newK = sellResult.newPools[0] * sellResult.newPools[1];
    expect(newK).toBeCloseTo(k, 4);
  });
});

describe("AMM - multi-outcome markets", () => {
  it("prices sum to 1 for 3 outcomes", () => {
    const prices = getPrices([100, 100, 100]);
    const sum = prices.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1);
  });

  it("buying in 3-outcome market works", () => {
    const pools = [100, 100, 100];
    const result = getBuyShares(pools, 0, 20);
    expect(result.shares).toBeGreaterThan(0);
    const newPrices = getPrices(result.newPools);
    expect(newPrices[0]).toBeGreaterThan(1 / 3);
  });
});

describe("AMM - getBuyCost", () => {
  it("calculates cost to buy a specific number of shares", () => {
    const pools = [100, 100];
    const cost = getBuyCost(pools, 0, 9.0909);
    expect(cost).toBeCloseTo(10, 1);
  });
});
