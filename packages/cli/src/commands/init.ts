import chalk from "chalk";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { REGISTRY } from "../../../../src/registry.js";
import { HASNA_HOME, dataPath, dirExists, execSafe } from "../../../../src/utils.js";

function ask(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function ensureDir(dir: string): boolean {
  if (dirExists(dir)) return false;
  try {
    mkdirSync(dir, { recursive: true });
    return true;
  } catch (err) {
    console.error(chalk.red(`  Failed to create ${dir}: ${err}`));
    return false;
  }
}

export function registerInitCommand(program: import("commander").Command): void {
  program
    .command("init")
    .description("Set up the hasna ecosystem: create data dirs, optionally configure RDS, install packages")
    .option("--skip-install", "Skip npm install of all packages")
    .option("--skip-rds", "Skip RDS configuration prompt")
    .option("-y, --yes", "Non-interactive mode, accept all defaults")
    .action(async (opts: { skipInstall?: boolean; skipRds?: boolean; yes?: boolean }) => {
      console.log(chalk.bold("hasna init") + chalk.dim(" — setting up your environment\n"));

      // 1. Create base directory
      let created = 0;
      if (ensureDir(HASNA_HOME)) {
        console.log(chalk.green(`  Created ${HASNA_HOME}`));
        created++;
      } else {
        console.log(chalk.dim(`  ${HASNA_HOME} already exists`));
      }

      // 2. Create data dirs for all packages
      console.log(chalk.dim("\n  Creating data directories..."));
      for (const pkg of REGISTRY) {
        const dp = dataPath(pkg.dataDir);
        if (ensureDir(dp)) {
          created++;
        }
      }
      console.log(chalk.green(`  ${created} directories created\n`));

      // 3. Create a default config file if not present
      const configPath = join(HASNA_HOME, "cli", "config.json");
      ensureDir(join(HASNA_HOME, "cli"));
      if (!existsSync(configPath)) {
        const defaultConfig = {
          version: 1,
          rds: {
            host: "",
            port: 5432,
            user: "",
            database: "cli",
            configured: false,
          },
          lastInit: new Date().toISOString(),
          autoUpdate: false,
        };
        writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
        console.log(chalk.green(`  Created config: ${configPath}`));
      } else {
        console.log(chalk.dim(`  Config exists: ${configPath}`));
      }

      // 4. RDS configuration
      if (!opts.skipRds) {
        console.log();
        let configureRds = false;
        if (opts.yes) {
          // In non-interactive mode, only configure if env vars are set
          configureRds = !!(process.env.HASNA_RDS_HOST || process.env.CLOUD_PG_HOST);
        } else {
          const answer = await ask("  Configure RDS connection? [y/N] ");
          configureRds = answer.toLowerCase() === "y";
        }

        if (configureRds) {
          const host =
            process.env.HASNA_RDS_HOST ||
            process.env.CLOUD_PG_HOST ||
            (opts.yes
              ? ""
              : await ask(
                  `  RDS host [${process.env.HASNA_RDS_HOST || "hasnaxyz-prod-opensource.c4limg0qgqvk.us-east-1.rds.amazonaws.com"}]: `,
                ));
          const user =
            process.env.HASNA_RDS_USER ||
            process.env.CLOUD_PG_USER ||
            (opts.yes ? "hasna_admin" : (await ask("  RDS user [hasna_admin]: ")) || "hasna_admin");
          const db = opts.yes ? "cli" : (await ask("  RDS database [cli]: ")) || "cli";

          if (host) {
            // Test connection
            const pw = process.env.HASNA_RDS_PASSWORD || process.env.CLOUD_PG_PASSWORD || "";
            const result = execSafe(
              `PGPASSWORD="${pw}" psql -h ${host} -U ${user} -d ${db} -c "SELECT 1;" 2>&1`,
              5000,
            );
            if (result && result.includes("1")) {
              console.log(chalk.green(`  RDS connection successful: ${host}/${db}`));
              // Update config
              try {
                const cfg = JSON.parse(
                  require("node:fs").readFileSync(configPath, "utf8"),
                );
                cfg.rds = { host, port: 5432, user, database: db, configured: true };
                writeFileSync(configPath, JSON.stringify(cfg, null, 2));
              } catch {
                // ignore config update failure
              }
            } else {
              console.log(chalk.yellow(`  RDS connection failed — skipping. You can reconfigure later with "hasna init".`));
            }
          }
        }
      }

      // 5. Install packages
      if (!opts.skipInstall) {
        console.log();
        let doInstall = false;
        if (opts.yes) {
          doInstall = true;
        } else {
          const answer = await ask("  Install all @hasna/* packages globally? [y/N] ");
          doInstall = answer.toLowerCase() === "y";
        }

        if (doInstall) {
          console.log(chalk.dim("\n  Installing packages (this may take a while)...\n"));
          const npmNames = REGISTRY.filter((p) => Object.keys(p.bins).length > 0).map((p) => p.npm);
          const cmd = `bun install -g ${npmNames.join(" ")} 2>&1`;
          const result = execSafe(cmd, 120_000);
          if (result) {
            console.log(chalk.green("  Packages installed successfully."));
          } else {
            console.log(chalk.yellow("  Some packages may have failed to install. Run 'hasna update' to retry."));
          }
        }
      }

      console.log(chalk.bold("\nDone! Run 'hasna doctor' to verify your setup."));
    });
}
