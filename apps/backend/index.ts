import "dotenv/config";
import { prisma } from "@repo/db";

async function main() {
  try {
    await prisma.$connect();

    const result = await prisma.$queryRaw`SELECT NOW()`;

    console.log("Database connected:", result);
  } catch (error) {
    console.error("Database connection failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();