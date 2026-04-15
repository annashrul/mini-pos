import { prisma } from "../src/lib/prisma";

async function main() {
  const branches = await prisma.branch.findMany({
    select: { id: true, name: true, address: true, latitude: true, longitude: true },
    orderBy: { name: "asc" },
  });
  console.log(JSON.stringify(branches, null, 2));
  process.exit(0);
}
main();
