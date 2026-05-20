/**
 * Constant-product AMM for prediction markets.
 *
 * For a binary market with pools [A, B], the invariant is A * B = k.
 * For multi-outcome markets, product(all pools) = k.
 */

/** Calculate price for each outcome. Price = product(other pools) / sum(product(other pools) for each). */
export function getPrices(pools: number[]): number[] {
  const products = pools.map((_, i) =>
    pools.reduce((acc, pool, j) => (j === i ? acc : acc * pool), 1)
  );
  const total = products.reduce((a, b) => a + b, 0);
  return products.map((p) => p / total);
}

/** Get price for a single outcome. */
export function getPrice(pools: number[], outcomeIndex: number): number {
  return getPrices(pools)[outcomeIndex];
}

/**
 * Buy shares of an outcome by spending `coins`.
 * Coins go into all OTHER outcome pools (split equally for multi-outcome).
 * Returns shares received and new pool state.
 */
export function getBuyShares(
  pools: number[],
  outcomeIndex: number,
  coins: number
): { shares: number; newPools: number[] } {
  const k = pools.reduce((a, b) => a * b, 1);
  const newPools = [...pools];

  // Add coins to all pools except the one being bought
  for (let i = 0; i < newPools.length; i++) {
    if (i !== outcomeIndex) {
      newPools[i] += coins / (pools.length - 1);
    }
  }

  // Restore invariant by adjusting the bought outcome's pool
  const otherProduct = newPools.reduce(
    (acc, pool, i) => (i === outcomeIndex ? acc : acc * pool),
    1
  );
  newPools[outcomeIndex] = k / otherProduct;

  const shares = pools[outcomeIndex] - newPools[outcomeIndex];
  return { shares, newPools };
}

/**
 * Calculate the cost in coins to buy a specific number of shares.
 * Uses binary search to find the coin amount that yields the target shares.
 */
export function getBuyCost(
  pools: number[],
  outcomeIndex: number,
  targetShares: number
): number {
  let lo = 0;
  let hi = pools[outcomeIndex] * 100; // upper bound
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    const result = getBuyShares(pools, outcomeIndex, mid);
    if (result.shares < targetShares) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return (lo + hi) / 2;
}

/**
 * Sell shares of an outcome back to the pool.
 * Returns coins received and new pool state.
 */
export function getSellReturn(
  pools: number[],
  outcomeIndex: number,
  shares: number
): { coinsReturned: number; newPools: number[] } {
  const k = pools.reduce((a, b) => a * b, 1);
  const newPools = [...pools];

  // Return shares to the pool
  newPools[outcomeIndex] += shares;

  // Restore invariant by adjusting other pools
  const targetOtherProduct = k / newPools[outcomeIndex];

  if (pools.length === 2) {
    // Binary: simple case
    const otherIndex = outcomeIndex === 0 ? 1 : 0;
    const oldOther = newPools[otherIndex];
    newPools[otherIndex] = targetOtherProduct;
    const coinsReturned = oldOther - newPools[otherIndex];
    return { coinsReturned, newPools };
  }

  // Multi-outcome: scale all other pools proportionally
  const currentOtherProduct = newPools.reduce(
    (acc, pool, i) => (i === outcomeIndex ? acc : acc * pool),
    1
  );
  const scaleFactor = Math.pow(
    targetOtherProduct / currentOtherProduct,
    1 / (pools.length - 1)
  );

  let coinsReturned = 0;
  for (let i = 0; i < newPools.length; i++) {
    if (i !== outcomeIndex) {
      const oldPool = newPools[i];
      newPools[i] = oldPool * scaleFactor;
      coinsReturned += oldPool - newPools[i];
    }
  }

  return { coinsReturned, newPools };
}

/** Calculate payout per share on settlement (always 100 coins). */
export const PAYOUT_PER_SHARE = 100;
