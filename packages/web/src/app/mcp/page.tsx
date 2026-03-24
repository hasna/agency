"use client";

import { useEffect, useState } from "react";

interface McpStatus {
  name: string;
  npm: string;
  mcpBin: string;
  version: string | null;
  toolCount: number | null;
  status: "ok" | "error" | "timeout" | "not_installed";
  error?: string;
  lastChecked: string;
}

export default function McpHealthPage() {
  const [mcps, setMcps] = useState<McpStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);

  async function fetchHealth() {
    setLoading(true);
    try {
      const res = await fetch("/api/mcp/health");
      const data = await res.json();
      setMcps(data);
    } catch {
      // Health endpoint unavailable
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchHealth();
  }, []);

  async function recheck() {
    setChecking(true);
    await fetchHealth();
    setChecking(false);
  }

  const okCount = mcps.filter((m) => m.status === "ok").length;
  const errorCount = mcps.filter(
    (m) => m.status === "error" || m.status === "timeout"
  ).length;
  const notInstalled = mcps.filter((m) => m.status === "not_installed").length;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">MCP Health</h1>
          <p className="text-muted-foreground mt-1">
            Health status of all MCP servers
          </p>
        </div>
        <button
          onClick={recheck}
          disabled={checking}
          className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
        >
          {checking ? (
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
              Checking...
            </span>
          ) : (
            "Re-check All"
          )}
        </button>
      </div>

      {/* Summary badges */}
      {!loading && (
        <div className="flex gap-3 mb-6">
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-success/10 text-success">
            {okCount} healthy
          </span>
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-destructive/10 text-destructive">
            {errorCount} errors
          </span>
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
            {notInstalled} not installed
          </span>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-14 rounded-lg bg-card border border-border animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-card border-b border-border">
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">
                  Name
                </th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">
                  Binary
                </th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">
                  Version
                </th>
                <th className="text-right px-4 py-3 text-muted-foreground font-medium">
                  Tools
                </th>
                <th className="text-center px-4 py-3 text-muted-foreground font-medium">
                  Status
                </th>
                <th className="text-right px-4 py-3 text-muted-foreground font-medium">
                  Checked
                </th>
              </tr>
            </thead>
            <tbody>
              {mcps.map((m) => (
                <tr
                  key={m.name}
                  className="border-b border-border last:border-0 hover:bg-card/50"
                >
                  <td className="px-4 py-3 font-medium">{m.name}</td>
                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                    {m.mcpBin}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {m.version || "-"}
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    {m.toolCount ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge status={m.status} />
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground text-xs">
                    {new Date(m.lastChecked).toLocaleTimeString()}
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

function StatusBadge({ status }: { status: McpStatus["status"] }) {
  const styles: Record<string, string> = {
    ok: "bg-success/10 text-success",
    error: "bg-destructive/10 text-destructive",
    timeout: "bg-warning/10 text-warning",
    not_installed: "bg-muted text-muted-foreground",
  };

  const labels: Record<string, string> = {
    ok: "Healthy",
    error: "Error",
    timeout: "Timeout",
    not_installed: "Not Installed",
  };

  return (
    <span
      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${
        styles[status] || styles.error
      }`}
    >
      {labels[status] || status}
    </span>
  );
}
