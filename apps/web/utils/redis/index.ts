import { env } from "@/env";
import Redis from "ioredis";
import { createScopedLogger } from "@/utils/logger";

const logger = createScopedLogger("redis");

// Initialize ioredis client with REDIS_URL
const ioRedisClient = new Redis(env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

ioRedisClient.on("error", (err) => {
  logger.error("Redis connection error", { error: err.message });
});

ioRedisClient.on("connect", () => {
  logger.info("Redis connected");
});

// Create Upstash-compatible wrapper around ioredis
export const redis = {
  get: async <T>(key: string): Promise<T | null> => {
    const val = await ioRedisClient.get(key);
    if (!val) return null;
    try {
      return JSON.parse(val) as T;
    } catch {
      return val as unknown as T;
    }
  },

  set: async (
    key: string,
    value: any,
    options?: { ex?: number; nx?: boolean }
  ): Promise<string | null> => {
    const serialized =
      typeof value === "string" ? value : JSON.stringify(value);
    
    // Handle NX (only set if not exists) with optional EX (expiration)
    if (options?.nx) {
      if (options?.ex) {
        // SET key value EX seconds NX
        return ioRedisClient.set(key, serialized, "EX", options.ex, "NX");
      }
      // SET key value NX
      return ioRedisClient.set(key, serialized, "NX");
    }
    
    // Handle just EX
    if (options?.ex) {
      return ioRedisClient.setex(key, options.ex, serialized);
    }
    
    return ioRedisClient.set(key, serialized);
  },

  del: async (...keys: string[]): Promise<number> => {
    if (keys.length === 0) return 0;
    return ioRedisClient.del(...keys);
  },

  expire: async (key: string, seconds: number): Promise<number> => {
    return ioRedisClient.expire(key, seconds);
  },

  hget: async <T>(key: string, field: string): Promise<T | null> => {
    const val = await ioRedisClient.hget(key, field);
    if (!val) return null;
    try {
      return JSON.parse(val) as T;
    } catch {
      return val as unknown as T;
    }
  },

  hset: async (key: string, data: Record<string, any>): Promise<number> => {
    const serialized: Record<string, string> = {};
    for (const [k, v] of Object.entries(data)) {
      serialized[k] = typeof v === "string" ? v : JSON.stringify(v);
    }
    return ioRedisClient.hset(key, serialized);
  },

  hdel: async (key: string, ...fields: string[]): Promise<number> => {
    if (fields.length === 0) return 0;
    return ioRedisClient.hdel(key, ...fields);
  },

  hgetall: async <T>(key: string): Promise<T | null> => {
    const data = await ioRedisClient.hgetall(key);
    if (!data || Object.keys(data).length === 0) return null;
    const parsed: Record<string, any> = {};
    for (const [k, v] of Object.entries(data)) {
      try {
        parsed[k] = JSON.parse(v);
      } catch {
        parsed[k] = v;
      }
    }
    return parsed as T;
  },

  hincrby: async (
    key: string,
    field: string,
    increment: number
  ): Promise<number> => {
    return ioRedisClient.hincrby(key, field, increment);
  },

  hincrbyfloat: async (
    key: string,
    field: string,
    increment: number
  ): Promise<string> => {
    return ioRedisClient.hincrbyfloat(key, field, increment);
  },

  scan: async (
    cursor: number,
    options?: { match?: string; count?: number }
  ): Promise<[number, string[]]> => {
    const scanOptions: { match?: string; count?: number } = {};
    if (options?.match) {
      scanOptions.match = options.match;
    }
    if (options?.count) {
      scanOptions.count = options.count;
    }
    const result = await ioRedisClient.scan(
      cursor,
      "MATCH",
      scanOptions.match || "*",
      "COUNT",
      scanOptions.count || 10
    );
    return [Number(result[0]), result[1]];
  },

  unlink: async (...keys: string[]): Promise<number> => {
    if (keys.length === 0) return 0;
    return ioRedisClient.unlink(...keys);
  },

  publish: async (channel: string, message: string): Promise<number> => {
    return ioRedisClient.publish(channel, message);
  },
};

export async function expire(key: string, seconds: number) {
  return redis.expire(key, seconds);
}
