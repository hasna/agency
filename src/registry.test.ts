import { describe, expect, it } from "bun:test";
import {
  REGISTRY,
  PACKAGE_COUNT,
  findPackage,
  mcpPackages,
  dbPackages,
  httpPackages,
} from "./registry";

describe("registry", () => {
  it("has 45 packages", () => {
    expect(REGISTRY.length).toBe(45);
    expect(PACKAGE_COUNT).toBe(45);
  });

  it("every entry has required fields", () => {
    for (const pkg of REGISTRY) {
      expect(pkg.name).toBeTruthy();
      expect(pkg.npm).toMatch(/^@hasna\//);
      expect(pkg.description).toBeTruthy();
      expect(typeof pkg.hasDb).toBe("boolean");
      expect(typeof pkg.hasMcp).toBe("boolean");
      expect(typeof pkg.hasHttp).toBe("boolean");
      expect(pkg.dataDir).toBeTruthy();
    }
  });

  it("no duplicate names", () => {
    const names = REGISTRY.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("no duplicate npm names", () => {
    const npms = REGISTRY.map((p) => p.npm);
    expect(new Set(npms).size).toBe(npms.length);
  });

  it("findPackage returns correct package", () => {
    const todos = findPackage("todos");
    expect(todos).toBeDefined();
    expect(todos!.npm).toBe("@hasna/todos");
    expect(todos!.hasMcp).toBe(true);
  });

  it("findPackage returns undefined for unknown", () => {
    expect(findPackage("nonexistent")).toBeUndefined();
  });

  it("mcpPackages returns only MCP packages", () => {
    const mcp = mcpPackages();
    expect(mcp.length).toBeGreaterThan(0);
    for (const pkg of mcp) {
      expect(pkg.hasMcp).toBe(true);
    }
  });

  it("dbPackages returns only DB packages", () => {
    const db = dbPackages();
    expect(db.length).toBeGreaterThan(0);
    for (const pkg of db) {
      expect(pkg.hasDb).toBe(true);
    }
  });

  it("httpPackages returns only HTTP packages", () => {
    const http = httpPackages();
    expect(http.length).toBeGreaterThan(0);
    for (const pkg of http) {
      expect(pkg.hasHttp).toBe(true);
    }
  });

  it("packages with MCP have mcp binary defined", () => {
    for (const pkg of mcpPackages()) {
      expect(pkg.bins.mcp).toBeTruthy();
    }
  });

  it("packages with HTTP have serve binary defined", () => {
    for (const pkg of httpPackages()) {
      expect(pkg.bins.serve).toBeTruthy();
    }
  });
});
