import { dbPackages } from "@/lib/registry";
import { dataPath, dirExists, formatBytes } from "@/lib/utils";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";

export const dynamic = "force-dynamic";

interface TableInfo {
  name: string;
  rowCount: number;
}

export async function GET() {
  const packages = dbPackages();

  const results = packages
    .map((pkg) => {
      const dir = dataPath(pkg.dataDir);
      if (!dirExists(dir)) {
        return null;
      }

      // Find all .db / .sqlite / .sqlite3 files
      const dbFiles: string[] = [];
      try {
        const entries = readdirSync(dir, { recursive: true }) as string[];
        for (const entry of entries) {
          if (
            entry.endsWith(".db") ||
            entry.endsWith(".sqlite") ||
            entry.endsWith(".sqlite3")
          ) {
            dbFiles.push(entry);
          }
        }
      } catch {
        // skip unreadable
      }

      // Calculate total size
      let totalSizeBytes = 0;
      for (const f of dbFiles) {
        try {
          totalSizeBytes += statSync(join(dir, f)).size;
        } catch {
          // skip
        }
      }

      // Get tables and row counts from each DB
      const tables: TableInfo[] = [];
      let lastModified: Date | null = null;

      for (const f of dbFiles) {
        const fullPath = join(dir, f);
        try {
          const fstat = statSync(fullPath);
          if (!lastModified || fstat.mtime > lastModified) {
            lastModified = fstat.mtime;
          }

          const db = new Database(fullPath, { readonly: true });
          try {
            const tableRows = db
              .prepare(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
              )
              .all() as { name: string }[];

            for (const row of tableRows) {
              try {
                const countResult = db
                  .prepare(`SELECT COUNT(*) as count FROM "${row.name}"`)
                  .get() as { count: number } | undefined;
                tables.push({
                  name: dbFiles.length > 1 ? `${f}:${row.name}` : row.name,
                  rowCount: countResult?.count ?? 0,
                });
              } catch {
                tables.push({
                  name: dbFiles.length > 1 ? `${f}:${row.name}` : row.name,
                  rowCount: 0,
                });
              }
            }
          } finally {
            db.close();
          }
        } catch {
          // Skip databases we can't open (locked, corrupt, etc.)
        }
      }

      return {
        name: pkg.name,
        npm: pkg.npm,
        dataDir: pkg.dataDir,
        dbFiles,
        totalSize: formatBytes(totalSizeBytes),
        totalSizeBytes,
        tables,
        lastModified: lastModified ? lastModified.toISOString() : null,
      };
    })
    .filter(Boolean);

  return Response.json(results);
}
