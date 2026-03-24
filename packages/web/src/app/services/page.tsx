"use client";

import { useEffect, useState } from "react";

interface ServiceInfo {
  name: string;
  npm: string;
  description: string;
  hasDb: boolean;
  hasMcp: boolean;
  hasHttp: boolean;
  dataDir: string;
  version: string | null;
  dbSize: string;
  dbSizeBytes: number;
  dataDirExists: boolean;
}

export default function ServicesPage() {
  const [services, setServices] = useState<ServiceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "mcp" | "db" | "http">("all");

  useEffect(() => {
    fetch("/api/services")
      .then((r) => r.json())
      .then((data) => setServices(data))
      .finally(() => setLoading(false));
  }, []);

  const filtered = services.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.description.toLowerCase().includes(search.toLowerCase());
    const matchesFilter =
      filter === "all" ||
      (filter === "mcp" && s.hasMcp) ||
      (filter === "db" && s.hasDb) ||
      (filter === "http" && s.hasHttp);
    return matchesSearch && matchesFilter;
  });

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Services</h1>
        <p className="text-muted-foreground mt-1">
          All {services.length} @hasna/* packages
        </p>
      </div>

      {/* Search + filter bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text"
          placeholder="Search services..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-4 py-2 rounded-lg bg-card border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <div className="flex gap-2">
          {(["all", "mcp", "db", "http"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === f
                  ? "bg-accent text-white"
                  : "bg-card border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {f === "all" ? "All" : f.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              className="h-44 rounded-xl bg-card border border-border animate-pulse"
            />
          ))}
        </div>
      ) : (
        <>
          <div className="text-sm text-muted-foreground mb-4">
            Showing {filtered.length} of {services.length} services
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((s) => (
              <ServiceCard key={s.name} service={s} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ServiceCard({ service }: { service: ServiceInfo }) {
  return (
    <div className="rounded-xl bg-card border border-border p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-foreground">{service.name}</h3>
          <div className="text-xs text-muted-foreground font-mono mt-0.5">
            {service.npm}
          </div>
        </div>
        <div className="flex gap-1.5">
          {service.hasMcp && (
            <StatusDot color="green" label="MCP" />
          )}
          {service.hasDb && (
            <StatusDot color="blue" label="DB" />
          )}
          {service.hasHttp && (
            <StatusDot color="purple" label="HTTP" />
          )}
        </div>
      </div>

      <p className="text-sm text-muted-foreground line-clamp-2">
        {service.description}
      </p>

      <div className="flex items-center gap-4 text-xs text-muted-foreground mt-auto pt-2 border-t border-border">
        {service.version && (
          <span>v{service.version}</span>
        )}
        {service.hasDb && (
          <span>{service.dbSize}</span>
        )}
        <span
          className={`ml-auto ${
            service.dataDirExists ? "text-success" : "text-muted-foreground"
          }`}
        >
          ~/.hasna/{service.dataDir}
        </span>
      </div>
    </div>
  );
}

function StatusDot({ color, label }: { color: string; label: string }) {
  const colorMap: Record<string, string> = {
    green: "bg-success",
    red: "bg-destructive",
    blue: "bg-accent",
    purple: "bg-purple-500",
    yellow: "bg-warning",
  };

  return (
    <span
      title={label}
      className={`w-2.5 h-2.5 rounded-full ${colorMap[color] || "bg-muted-foreground"}`}
    />
  );
}
