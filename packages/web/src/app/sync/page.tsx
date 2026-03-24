"use client";

import { useEffect, useState } from "react";

interface SyncInfo {
  name: string;
  npm: string;
  hasDb: boolean;
  dataDir: string;
  dataDirExists: boolean;
  localRowCount: number;
  dbSize: string;
  dbSizeBytes: number;
  lastModified: string | null;
}

export default function SyncPage() {
  const [services, setServices] = useState<SyncInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchServices();
  }, []);

  async function fetchServices() {
    setLoading(true);
    try {
      const res = await fetch("/api/db/stats");
      const data = await res.json();
      const mapped: SyncInfo[] = data.map(
        (s: {
          name: string;
          npm: string;
          dataDir: string;
          totalSize: string;
          totalSizeBytes: number;
          tables: { name: string; rowCount: number }[];
          lastModified: string | null;
        }) => ({
          name: s.name,
          npm: s.npm,
          hasDb: true,
          dataDir: s.dataDir,
          dataDirExists: true,
          localRowCount: s.tables.reduce(
            (sum: number, t: { rowCount: number }) => sum + t.rowCount,
            0
          ),
          dbSize: s.totalSize,
          dbSizeBytes: s.totalSizeBytes,
          lastModified: s.lastModified,
        })
      );
      setServices(mapped);
    } catch {
      // endpoint unavailable
    } finally {
      setLoading(false);
    }
  }

  async function syncAction(name: string, direction: "push" | "pull") {
    setSyncing((prev) => ({ ...prev, [name]: direction }));
    try {
      await fetch(`/api/sync/${direction}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service: name }),
      });
      await fetchServices();
    } finally {
      setSyncing((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  }

  async function syncAll(direction: "push" | "pull") {
    setSyncing({ __all: direction });
    try {
      await fetch(`/api/sync/${direction}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service: "__all" }),
      });
      await fetchServices();
    } finally {
      setSyncing({});
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sync</h1>
          <p className="text-muted-foreground mt-1">
            Push and pull service databases to/from the cloud
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => syncAll("push")}
            disabled={!!syncing.__all}
            className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
          >
            {syncing.__all === "push" ? "Pushing..." : "Push All"}
          </button>
          <button
            onClick={() => syncAll("pull")}
            disabled={!!syncing.__all}
            className="px-4 py-2 rounded-lg bg-muted text-foreground text-sm font-medium hover:bg-muted/80 transition-colors disabled:opacity-50"
          >
            {syncing.__all === "pull" ? "Pulling..." : "Pull All"}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-16 rounded-lg bg-card border border-border animate-pulse"
            />
          ))}
        </div>
      ) : services.length === 0 ? (
        <div className="rounded-xl bg-card border border-border p-8 text-center text-muted-foreground">
          No services with databases found.
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-card border-b border-border">
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">
                  Service
                </th>
                <th className="text-right px-4 py-3 text-muted-foreground font-medium">
                  Local Rows
                </th>
                <th className="text-right px-4 py-3 text-muted-foreground font-medium">
                  DB Size
                </th>
                <th className="text-right px-4 py-3 text-muted-foreground font-medium">
                  Last Modified
                </th>
                <th className="text-right px-4 py-3 text-muted-foreground font-medium">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {services.map((s) => (
                <tr
                  key={s.name}
                  className="border-b border-border last:border-0 hover:bg-card/50"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium">{s.name}</div>
                    <div className="text-xs text-muted-foreground font-mono">
                      ~/.hasna/{s.dataDir}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    {s.localRowCount.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    {s.dbSize}
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground text-xs">
                    {s.lastModified
                      ? new Date(s.lastModified).toLocaleString()
                      : "-"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => syncAction(s.name, "push")}
                        disabled={!!syncing[s.name]}
                        className="px-3 py-1 rounded-md bg-accent/10 text-accent text-xs font-medium hover:bg-accent/20 transition-colors disabled:opacity-50"
                      >
                        {syncing[s.name] === "push" ? "..." : "Push"}
                      </button>
                      <button
                        onClick={() => syncAction(s.name, "pull")}
                        disabled={!!syncing[s.name]}
                        className="px-3 py-1 rounded-md bg-muted text-muted-foreground text-xs font-medium hover:bg-muted/80 transition-colors disabled:opacity-50"
                      >
                        {syncing[s.name] === "pull" ? "..." : "Pull"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
