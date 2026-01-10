// eslint-disable no-process-env
// Run with: `NODE_ENV=development npx tsx scripts/listRedisUsage.ts`

import "dotenv/config";
import { redis } from "@/utils/redis";

async function scanUsageKeys() {
  let cursor: string | number = 0;
  let keys: string[] = [];
  do {
    const reply: [string, string[]] = await redis.scan(cursor as string, { match: "usage:*", count: 100 });
    cursor = reply[0];
    keys = [...keys, ...reply[1]];
  } while (cursor !== "0");

  const costs = await Promise.all(
    keys.map(async (key) => {
      const data = await redis.hgetall<{ cost?: string }>(key);
      const cost = data?.cost;
      if (!cost) return { email: key, cost: 0, data };
      return {
        email: key,
        cost: Number.parseFloat(Number.parseFloat(cost).toFixed(1)),
        data,
      };
    }),
  );

  const totalCost = costs.reduce((acc, { cost }) => acc + cost, 0);

  const sortedCosts = costs.sort((a, b) => a.cost - b.cost);
  for (const { email, cost, data } of sortedCosts) {
    // if (cost > 10)
    console.log(email, cost, data);
  }

  console.log("totalCost:", totalCost);
}

scanUsageKeys().catch(console.error);
