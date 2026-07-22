export const CLIENT_SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "Client" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessName" TEXT NOT NULL,
    "searchText" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "publicPhone" TEXT,
    "publicEmail" TEXT,
    "addressLine" TEXT,
    "locality" TEXT,
    "region" TEXT,
    "country" TEXT,
    "postalCode" TEXT,
    "category" TEXT,
    "notes" TEXT,
    "owner" TEXT,
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "Website" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "normalizedUrl" TEXT NOT NULL,
    "normalizedDomain" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Website_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "Tag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS "ClientTag" (
    "clientId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    PRIMARY KEY ("clientId", "tagId"),
    CONSTRAINT "ClientTag_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClientTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "ClientActivity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClientActivity_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS "Client_status_updatedAt_idx" ON "Client"("status", "updatedAt")`,
  `CREATE INDEX IF NOT EXISTS "Client_searchText_idx" ON "Client"("searchText")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Website_normalizedDomain_key" ON "Website"("normalizedDomain")`,
  `CREATE INDEX IF NOT EXISTS "Website_clientId_idx" ON "Website"("clientId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Tag_normalizedName_key" ON "Tag"("normalizedName")`,
  `CREATE INDEX IF NOT EXISTS "ClientTag_tagId_idx" ON "ClientTag"("tagId")`,
  `CREATE INDEX IF NOT EXISTS "ClientActivity_clientId_createdAt_idx" ON "ClientActivity"("clientId", "createdAt")`,
] as const;
