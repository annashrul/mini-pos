import { prisma } from "@/lib/prisma";

export const transactionRepository = {
  findMany: () =>
    prisma.transaction.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
};
