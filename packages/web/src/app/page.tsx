"use client";

import { useEffect, useState } from "react";

interface StatusData {
  totalServices: number;
  servicesWithDb: number;
  servicesWithMcp: number;
  servicesWithHttp: number;
  servicesWithErrors: number;
  totalDbSize: string;
  totalDbSizeBytes: number;
  lastChecked: string;
}

export default function OverviewPage() {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionRunning, setActionRunning] = useState<string | null>(null);

  useEffect(() => {
    fetchStatus();
  }, []);

  async function fetchStatus() {
    setLoading(true);
    try {
      const res = await fetch("/api/status");
      const data = await res.json();
      setStatus(data);
    } catch {
      // Status endpoint unavailable
    } finally {
      setLoading(false);
    }
  }

  async function runAction(action: string) {
    setActionRunning(action);
    try {
      if (action === "sync") {
        await fetch("/api/sync/push", { method: "POST" });
      } else if (action === "doctor") {
        await fetch("/api/mcp/health");
      } else if (action === "mcp") {
        await fetch("/api/mcp/health");
      }
      await fetchStatus();
    } finally {
      setActionRunning(null);
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
        <p className="text-muted-foreground mt-1">
          Status summary of all @hasna/* packages
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-32 rounded-xl bg-card border border-border animate-pulse"
            />
          ))}
        </div>
      ) : status ? (
        <>
          {/* Stats grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            <StatCard
              label="Total Services"
              value={String(status.totalServices)}
              sub={`${status.servicesWithDb} with DB`}
              color="accent"
            />
            <StatCard
              label="Services with Errors"
              value={String(status.servicesWithErrors)}
              sub="failed health checks"
              color={status.servicesWithErrors > 0 ? "destructive" : "success"}
            />
            <StatCard
              label="MCP Servers"
              value={String(status.servicesWithMcp)}
              sub={`${status.servicesWithHttp} with HTTP`}
              color="accent"
            />
            <StatCard
              label="Total DB Size"
              value={status.totalDbSize}
              sub={`across ${status.servicesWithDb} databases`}
              color="accent"
            />
            <StatCard
              label="Last Checked"
              value={new Date(status.lastChecked).toLocaleTimeString()}
              sub={new Date(status.lastChecked).toLocaleDateString()}
              color="muted-foreground"
            />
            <StatCard
              label="HTTP Servers"
              value={String(status.servicesWithHttp)}
              sub="REST API endpoints"
              color="accent"
            />
          </div>

          {/* Quick actions */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-3">Quick Actions</h2>
            <div className="flex flex-wrap gap-3">
              <ActionButton
                label="Sync All"
                onClick={() => runAction("sync")}
                loading={actionRunning === "sync"}
              />
              <ActionButton
                label="Run Doctor"
                onClick={() => runAction("doctor")}
                loading={actionRunning === "doctor"}
              />
              <ActionButton
                label="Check MCPs"
                onClick={() => runAction("mcp")}
                loading={actionRunning === "mcp"}
              />
              <ActionButton
                label="Refresh"
                onClick={fetchStatus}
                loading={loading}
                variant="secondary"
              />
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-xl bg-card border border-border p-8 text-center">
          <p className="text-muted-foreground">
            Could not load status. Make sure the API is running.
          </p>
          <button
            onClick={fetchStatus}
            className="mt-4 px-4 py-2 rounded-lg bg-accent text-white text-sm hover:bg-accent/90 transition-colors"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    accent: "text-accent",
    destructive: "text-destructive",
    success: "text-success",
    warning: "text-warning",
    "muted-foreground": "text-muted-foreground",
  };

  return (
    <div className="rounded-xl bg-card border border-border p-5">
      <div className="text-sm text-muted-foreground mb-2">{label}</div>
      <div className={`text-3xl font-bold ${colorMap[color] || "text-foreground"}`}>
        {value}
      </div>
      <div className="text-xs text-muted-foreground mt-1">{sub}</div>
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  loading,
  variant = "primary",
}: {
  label: string;
  onClick: () => void;
  loading: boolean;
  variant?: "primary" | "secondary";
}) {
  const base =
    variant === "primary"
      ? "bg-accent text-white hover:bg-accent/90"
      : "bg-muted text-foreground hover:bg-muted/80";

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${base}`}
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
          Running...
        </span>
      ) : (
        label
      )}
    </button>
  );
}
