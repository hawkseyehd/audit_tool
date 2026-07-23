export const SCOPE_SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "AuditScope" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "clientBusinessName" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "normalizedDomain" TEXT NOT NULL,
    "configurationJson" TEXT NOT NULL,
    "reportFormatsJson" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "selectedPageCount" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditScope_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AuditScope_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "AuditScopePage" (
    "scopeId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "normalizedUrl" TEXT NOT NULL,
    "pageType" TEXT NOT NULL,
    PRIMARY KEY ("scopeId", "pageId"),
    CONSTRAINT "AuditScopePage_scopeId_fkey" FOREIGN KEY ("scopeId") REFERENCES "AuditScope" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS "AuditScope_clientId_createdAt_idx"
    ON "AuditScope"("clientId", "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "AuditScope_websiteId_createdAt_idx"
    ON "AuditScope"("websiteId", "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "AuditScopePage_scopeId_normalizedUrl_idx"
    ON "AuditScopePage"("scopeId", "normalizedUrl")`,
] as const;
