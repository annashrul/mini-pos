"use server";

import { createClient } from "redis";

type JsonValue = Record<string, unknown> | unknown[];
type RedisClient = ReturnType<typeof createClient>;

const globalForRedis = globalThis as unknown as {
  redis: RedisClient | null | undefined;
  redisConnectPromise: Promise<unknown> | null | undefined;
};

const redisUrl = process.env.REDIS_URL;

function makeClient() {
  if (!redisUrl) return null;
  let protocol = "";
  try {
    protocol = new URL(redisUrl).protocol;
  } catch {
    return null;
  }
  if (protocol !== "redis:" && protocol !== "rediss:") {
    return null;
  }
  const client = createClient({
    url: redisUrl,
    socket: {
      connectTimeout: 3000,
      reconnectStrategy: (retries) => (retries > 2 ? false : Math.min(retries * 500, 2000)),
    },
  });
  client.on("error", () => {});
  return client;
}

const redis = globalForRedis.redis ?? makeClient();

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}

async function getRedis() {
  if (!redis) return null;
  if (redis.isOpen) return redis;
  if (!globalForRedis.redisConnectPromise) {
    globalForRedis.redisConnectPromise = Promise.race([
      redis.connect().catch(() => {}),
      new Promise((resolve) => setTimeout(resolve, 3000)),
    ]);
  }
  await globalForRedis.redisConnectPromise;
  globalForRedis.redisConnectPromise = null;
  return redis.isOpen ? redis : null;
}

export async function redisGetJson<T extends JsonValue>(key: string) {
  try {
    const client = await getRedis();
    if (!client) return null;
    const raw = await client.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function redisSetJson(
  key: string,
  value: JsonValue,
  ttlSeconds?: number,
) {
  try {
    const client = await getRedis();
    if (!client) return;
    const payload = JSON.stringify(value);
    if (ttlSeconds && ttlSeconds > 0) {
      await client.setEx(key, ttlSeconds, payload);
      return;
    }
    await client.set(key, payload);
  } catch {
    // Silently fail — Redis is optional cache
  }
}

export async function redisDel(key: string) {
  try {
    const client = await getRedis();
    if (!client) return;
    await client.del(key);
  } catch {
    // Silently fail
  }
}

export async function redisDelByPrefix(prefix: string) {
  try {
    const client = await getRedis();
    if (!client) return;
    const keys = await client.keys(`${prefix}*`);
    if (keys.length === 0) return;
    await client.del(keys);
  } catch {
    // Silently fail
  }
}
