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
  const client = createClient({ url: redisUrl });
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
    globalForRedis.redisConnectPromise = redis.connect().catch(() => {});
  }
  await globalForRedis.redisConnectPromise;
  return redis.isOpen ? redis : null;
}

export async function redisGetJson<T extends JsonValue>(key: string) {
  const client = await getRedis();
  if (!client) return null;
  const raw = await client.get(key);
  if (!raw) return null;
  return JSON.parse(raw) as T;
}

export async function redisSetJson(
  key: string,
  value: JsonValue,
  ttlSeconds?: number,
) {
  const client = await getRedis();
  if (!client) return;
  const payload = JSON.stringify(value);
  if (ttlSeconds && ttlSeconds > 0) {
    await client.setEx(key, ttlSeconds, payload);
    return;
  }
  await client.set(key, payload);
}

export async function redisDel(key: string) {
  const client = await getRedis();
  if (!client) return;
  await client.del(key);
}

export async function redisDelByPrefix(prefix: string) {
  const client = await getRedis();
  if (!client) return;
  const keys = await client.keys(`${prefix}*`);
  if (keys.length === 0) return;
  await client.del(keys);
}
