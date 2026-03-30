import { prisma } from "@/lib/prisma";

export const userRepository = {
  findMany: () => prisma.user.findMany(),
};
