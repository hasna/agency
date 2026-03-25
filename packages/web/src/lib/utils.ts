/**
 * Inline copy of shared utilities from the monorepo root.
 * Kept in sync with ../../src/utils.ts
 */

import { execSync, spawn, type SpawnOptions } from "node:child_process";
import { existsSync, statSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";

/** The base data directory: ~/.hasna */
export const HASNA_HOME = resolve(join(homedir(), ".hasna"));

/** Resolve a data dir for a given package name */
export function dataPath(name: string): string {
  return join(HASNA_HOME, name);
}

/** Check if a directory exists */
export function dirExists(p: string): boolean {
  try {
    return existsSync(p) && statSync(p).isDirectory();
  } catch {
    return false;
  }
}

/** Check if a file exists */
export function fileExists(p: string): boolean {
  try {
    return existsSync(p) && statSync(p).isFile();
  } catch {
    return false;
  }
}

/** Get total size of .db files in a directory (bytes) */
export function dbSize(dir: string): number {
  if (!dirExists(dir)) return 0;
  try {
    let total = 0;
    const entries = readdirSync(dir, { recursive: true }) as string[];
    for (const entry of entries) {
      const full = join(dir, entry);
      if (full.endsWith(".db") || full.endsWith(".sqlite") || full.endsWith(".sqlite3")) {
        try {
          total += statSync(full).size;
        } catch {
          // skip unreadable files
        }
      }
    }
    return total;
  } catch {
    return 0;
  }
}

/** Format bytes into human-readable string */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

/** Run a command and return stdout, or null on failure */
export function execSafe(cmd: string, timeoutMs = 10_000): string | null {
  try {
    return execSync(cmd, {
      encoding: "utf8",
      timeout: timeoutMs,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    return null;
  }
}

/** Get globally installed version of an npm package (sync) */
export function getInstalledVersion(npmName: string): string | null {
  const result = execSafe(`npm ls -g ${npmName} --depth=0 --json 2>/dev/null`);
  if (!result) return null;
  try {
    const parsed = JSON.parse(result);
    const deps = parsed.dependencies || {};
    const key = Object.keys(deps).find((k) => k === npmName);
    return key ? deps[key].version || null : null;
  } catch {
    return null;
  }
}

/** Get globally installed version of an npm package (async, with short timeout) */
export async function getInstalledVersionAsync(
  npmName: string,
): Promise<string | null> {
  const { stdout } = await spawnWithTimeout(
    "npm",
    ["ls", "-g", npmName, "--depth=0", "--json"],
    5_000,
  );
  if (!stdout) return null;
  try {
    const parsed = JSON.parse(stdout);
    const deps = parsed.dependencies || {};
    const key = Object.keys(deps).find((k) => k === npmName);
    return key ? deps[key].version || null : null;
  } catch {
    return null;
  }
}

/** Spawn a child process with a timeout and return exit code + stdout + stderr */
export function spawnWithTimeout(
  cmd: string,
  args: string[],
  timeoutMs: number,
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let killed = false;

    const opts: SpawnOptions = { stdio: ["pipe", "pipe", "pipe"] };
    const child = spawn(cmd, args, opts);

    const timer = setTimeout(() => {
      killed = true;
      child.kill("SIGTERM");
    }, timeoutMs);

    child.stdout?.on("data", (d: Buffer) => {
      stdout += d.toString();
    });
    child.stderr?.on("data", (d: Buffer) => {
      stderr += d.toString();
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (killed) {
        resolve({ code: null, stdout, stderr: stderr + "\n[timeout]" });
      } else {
        resolve({ code, stdout, stderr });
      }
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ code: null, stdout, stderr: err.message });
    });
  });
}

/** Check if a binary exists on PATH */
export function binaryExists(name: string): boolean {
  return execSafe(`which ${name}`) !== null;
}
