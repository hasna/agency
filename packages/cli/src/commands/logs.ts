import chalk from "chalk";
import { existsSync, readFileSync, readdirSync, statSync, watch } from "node:fs";
import { join } from "node:path";
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { HASNA_HOME, dirExists, dataPath } from "../../../../src/utils.js";
import { REGISTRY } from "../../../../src/registry.js";

const ACTIVITY_LOG = join(HASNA_HOME, "cloud", "activity.log");

/** Color palette for services — cycles through these */
const SERVICE_COLORS = [
  chalk.cyan,
  chalk.magenta,
  chalk.yellow,
  chalk.green,
  chalk.blue,
  chalk.red,
  chalk.white,
  chalk.gray,
  chalk.cyanBright,
  chalk.magentaBright,
  chalk.yellowBright,
  chalk.greenBright,
  chalk.blueBright,
  chalk.redBright,
];

function getServiceColor(service: string, colorMap: Map<string, (s: string) => string>): (s: string) => string {
  if (!colorMap.has(service)) {
    const idx = colorMap.size % SERVICE_COLORS.length;
    colorMap.set(service, SERVICE_COLORS[idx]);
  }
  return colorMap.get(service)!;
}

/** Find all .log files across service data directories */
function findLogFiles(services?: string[]): Array<{ service: string; path: string }> {
  const results: Array<{ service: string; path: string }> = [];

  // Main activity log
  if (existsSync(ACTIVITY_LOG)) {
    results.push({ service: "cloud", path: ACTIVITY_LOG });
  }

  // Per-service log files
  const targets = services && services.length > 0
    ? REGISTRY.filter((p) => services.includes(p.name))
    : REGISTRY;

  for (const pkg of targets) {
    const dp = dataPath(pkg.dataDir);
    if (!dirExists(dp)) continue;

    try {
      const entries = readdirSync(dp, { recursive: true }) as string[];
      for (const entry of entries) {
        if (!entry.endsWith(".log")) continue;
        const full = join(dp, entry);
        try {
          if (statSync(full).isFile()) {
            results.push({ service: pkg.name, path: full });
          }
        } catch {
          // skip unreadable
        }
      }
    } catch {
      // skip unreadable dirs
    }
  }

  return results;
}

/** Parse duration strings like "1h", "30m", "2d" into milliseconds */
function parseDuration(dur: string): number | null {
  const match = dur.match(/^(\d+)(s|m|h|d)$/);
  if (!match) return null;

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case "s": return value * 1000;
    case "m": return value * 60 * 1000;
    case "h": return value * 60 * 60 * 1000;
    case "d": return value * 24 * 60 * 60 * 1000;
    default: return null;
  }
}

/** Check if a line matches error patterns */
function isErrorLine(line: string): boolean {
  const lower = line.toLowerCase();
  return lower.includes("error") || lower.includes("fail") || lower.includes("fatal") || lower.includes("panic");
}

/** Try to extract a timestamp from a log line */
function extractTimestamp(line: string): Date | null {
  // Try ISO format: 2024-01-15T10:30:00
  const isoMatch = line.match(/(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2})/);
  if (isoMatch) {
    const d = new Date(isoMatch[1]);
    if (!isNaN(d.getTime())) return d;
  }

  // Try bracket format: [2024-01-15 10:30:00]
  const bracketMatch = line.match(/\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\]/);
  if (bracketMatch) {
    const d = new Date(bracketMatch[1]);
    if (!isNaN(d.getTime())) return d;
  }

  return null;
}

/** Read last N lines from a file */
function readLastLines(filePath: string, maxLines: number): string[] {
  try {
    const content = readFileSync(filePath, "utf8");
    const lines = content.split("\n").filter(Boolean);
    return lines.slice(-maxLines);
  } catch {
    return [];
  }
}

/** Format a log line with service color */
function formatLine(service: string, line: string, colorFn: (s: string) => string): string {
  const trimmed = line.trim();
  if (!trimmed) return "";
  return `${chalk.dim("[")}${colorFn(service.padEnd(14))}${chalk.dim("]")} ${trimmed}`;
}

export function registerLogsCommand(program: import("commander").Command): void {
  program
    .command("logs [services...]")
    .description("Unified log stream across services")
    .option("--errors", "Only show error lines")
    .option("--since <duration>", "Filter logs from duration ago (e.g. 1h, 30m, 2d)")
    .option("--tail <lines>", "Number of recent lines to show initially", "50")
    .option("--no-follow", "Print logs and exit without following")
    .action((services: string[], opts: { errors?: boolean; since?: string; tail: string; follow: boolean }) => {
      const logFiles = findLogFiles(services.length > 0 ? services : undefined);

      if (logFiles.length === 0) {
        console.log(chalk.yellow("No log files found."));
        console.log(chalk.dim(`  Checked: ${ACTIVITY_LOG}`));
        console.log(chalk.dim(`  And per-service directories under ${HASNA_HOME}/`));
        return;
      }

      const colorMap = new Map<string, (s: string) => string>();
      const tailCount = parseInt(opts.tail, 10) || 50;

      // Determine time cutoff if --since is provided
      let cutoff: Date | null = null;
      if (opts.since) {
        const ms = parseDuration(opts.since);
        if (ms === null) {
          console.error(chalk.red(`Invalid duration: ${opts.since}. Use format like 1h, 30m, 2d`));
          process.exit(1);
        }
        cutoff = new Date(Date.now() - ms);
      }

      console.log(chalk.bold("agency logs") + chalk.dim(` — streaming ${logFiles.length} log file(s)\n`));

      for (const lf of logFiles) {
        console.log(chalk.dim(`  ${lf.service}: ${lf.path}`));
      }
      console.log();

      // Print recent lines from each file
      for (const lf of logFiles) {
        const colorFn = getServiceColor(lf.service, colorMap);
        const lines = readLastLines(lf.path, tailCount);

        for (const line of lines) {
          if (opts.errors && !isErrorLine(line)) continue;

          if (cutoff) {
            const ts = extractTimestamp(line);
            if (ts && ts < cutoff) continue;
          }

          const formatted = formatLine(lf.service, line, colorFn);
          if (formatted) console.log(formatted);
        }
      }

      // If --no-follow, exit here
      if (!opts.follow) return;

      console.log(chalk.dim("\n--- watching for new lines (Ctrl+C to stop) ---\n"));

      // Watch each log file for changes
      const watchers: ReturnType<typeof watch>[] = [];
      const filePositions = new Map<string, number>();

      // Record current file sizes
      for (const lf of logFiles) {
        try {
          const size = statSync(lf.path).size;
          filePositions.set(lf.path, size);
        } catch {
          filePositions.set(lf.path, 0);
        }
      }

      for (const lf of logFiles) {
        const colorFn = getServiceColor(lf.service, colorMap);

        try {
          const watcher = watch(lf.path, () => {
            try {
              const currentSize = statSync(lf.path).size;
              const prevSize = filePositions.get(lf.path) || 0;

              if (currentSize <= prevSize) {
                // File was truncated or unchanged
                filePositions.set(lf.path, currentSize);
                return;
              }

              // Read new content
              const stream = createReadStream(lf.path, {
                start: prevSize,
                end: currentSize - 1,
                encoding: "utf8",
              });

              let buffer = "";
              stream.on("data", (chunk: string) => {
                buffer += chunk;
              });

              stream.on("end", () => {
                const newLines = buffer.split("\n").filter(Boolean);
                for (const line of newLines) {
                  if (opts.errors && !isErrorLine(line)) continue;

                  if (cutoff) {
                    const ts = extractTimestamp(line);
                    if (ts && ts < cutoff) continue;
                  }

                  const formatted = formatLine(lf.service, line, colorFn);
                  if (formatted) console.log(formatted);
                }
              });

              filePositions.set(lf.path, currentSize);
            } catch {
              // skip read errors during watch
            }
          });

          watchers.push(watcher);
        } catch {
          // skip files we can't watch
        }
      }

      // Cleanup on exit
      process.on("SIGINT", () => {
        for (const w of watchers) {
          w.close();
        }
        console.log(chalk.dim("\nStopped."));
        process.exit(0);
      });
    });
}
