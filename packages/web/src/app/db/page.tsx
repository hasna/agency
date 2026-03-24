"use client";

import { useEffect, useState } from "react";

interface DbTableInfo {
  name: string;
  rowCount: number;
}

interface DbServiceStats {
  name: string;
  npm: string;
  dataDir: string;
  dbFiles: string[];
  totalSize: string;
  totalSizeBytes: number;
  tables: DbTableInfo[];
  lastModified: string | null;
  error?: string;
}

export default function DatabasePage() {
  const [stats, setStats] = useState<DbServiceStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/db/stats")
      .then((r) => r.json())
      .then((data) => setStats(data))
      .finally(() => setLoading(false));
  }, []);

  function toggle(name: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }

  const totalSize = stats.reduce((sum, s) => sum + s.totalSizeBytes, 0);
  const totalTables = stats.reduce((sum, s) => sum + s.tables.length, 0);
  const totalRows = stats.reduce(
    (sum, s) => sum + s.tables.reduce((ts, t) => ts + t.rowCount, 0),
    0
  );

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Database</h1>
        <p className="text-muted-foreground mt-1">
          Per-service SQLite database details
        </p>
      </div>

      {!loading && (
        <div className="flex gap-4 mb-6">
          <div className="px-4 py-2 rounded-lg bg-card border border-border text-sm">
            <span className="text-muted-foreground">Total size:</span>{" "}
            <span className="font-medium">{formatSize(totalSize)}</span>
          </div>
          <div className="px-4 py-2 rounded-lg bg-card border border-border text-sm">
            <span className="text-muted-foreground">Tables:</span>{" "}
            <span className="font-medium">{totalTables}</span>
          </div>
          <div className="px-4 py-2 rounded-lg bg-card border border-border text-sm">
            <span className="text-muted-foreground">Rows:</span>{" "}
            <span className="font-medium">{totalRows.toLocaleString()}</span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-16 rounded-lg bg-card border border-border animate-pulse"
            />
          ))}
        </div>
      ) : stats.length === 0 ? (
        <div className="rounded-xl bg-card border border-border p-8 text-center text-muted-foreground">
          No databases found. Services may not have been initialized yet.
        </div>
      ) : (
        <div className="space-y-2">
          {stats.map((s) => (
            <div
              key={s.name}
              className="rounded-xl border border-border overflow-hidden"
            >
              {/* Header row */}
              <button
                onClick={() => toggle(s.name)}
                className="w-full flex items-center justify-between px-5 py-3 bg-card hover:bg-muted/50 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <svg
                    className={`w-4 h-4 text-muted-foreground transition-transform ${
                      expanded.has(s.name) ? "rotate-90" : ""
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                  <span className="font-medium">{s.name}</span>
                  <span className="text-xs text-muted-foreground font-mono">
                    {s.npm}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>{s.tables.length} tables</span>
                  <span>{s.totalSize}</span>
                  {s.lastModified && (
                    <span className="text-xs">
                      {new Date(s.lastModified).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </button>

              {/* Expanded tables */}
              {expanded.has(s.name) && (
                <div className="border-t border-border">
                  {s.error ? (
                    <div className="px-5 py-3 text-sm text-destructive">
                      {s.error}
                    </div>
                  ) : s.tables.length === 0 ? (
                    <div className="px-5 py-3 text-sm text-muted-foreground">
                      No tables found
                    </div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/30">
                          <th className="text-left px-5 py-2 text-muted-foreground font-medium">
                            Table
                          </th>
                          <th className="text-right px-5 py-2 text-muted-foreground font-medium">
                            Rows
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {s.tables.map((t) => (
                          <tr
                            key={t.name}
                            className="border-t border-border/50"
                          >
                            <td className="px-5 py-2 font-mono text-xs">
                              {t.name}
                            </td>
                            <td className="px-5 py-2 text-right text-muted-foreground">
                              {t.rowCount.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  <div className="px-5 py-2 border-t border-border/50 text-xs text-muted-foreground">
                    DB files: {s.dbFiles.join(", ") || "none"}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}
