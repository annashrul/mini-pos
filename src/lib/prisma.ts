import { PrismaClient } from "@prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const shouldUseAccelerate =
  !!process.env.PRISMA_ACCELERATE_URL ||
  (process.env.DATABASE_URL?.startsWith("prisma://") ?? false) ||
  (process.env.DATABASE_URL?.startsWith("prisma+postgres://") ?? false);

function createPrismaClient(): PrismaClient {
  const client = new PrismaClient();
  if (!shouldUseAccelerate) return client;
  return client.$extends(withAccelerate()) as unknown as PrismaClient;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
