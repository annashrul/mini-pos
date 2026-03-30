import { prisma } from "@/lib/prisma";

export const productRepository = {
  findMany: () => prisma.product.findMany(),
};
