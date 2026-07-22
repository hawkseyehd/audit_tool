import { PrismaClient } from "@prisma/client";

const database = new PrismaClient();

try {
  await database.appMetadata.upsert({
    create: { id: "workspace", schemaVersion: 1 },
    update: { schemaVersion: 1 },
    where: { id: "workspace" },
  });
} finally {
  await database.$disconnect();
}
