#!/usr/bin/env bun

import { Command } from "commander";
import { registerStatusCommand } from "../commands/status.js";
import { registerDoctorCommand } from "../commands/doctor.js";
import { registerInitCommand } from "../commands/init.js";
import { registerUpdateCommand } from "../commands/update.js";
import { registerSyncCommand } from "../commands/sync.js";
import { registerMcpCommand } from "../commands/mcp.js";
import { registerBackupCommand } from "../commands/backup.js";
import { registerDbCommand } from "../commands/db.js";
import { PACKAGE_COUNT } from "../registry.js";

const program = new Command();

program
  .name("hasna")
  .description(`Unified management CLI for all ${PACKAGE_COUNT} @hasna/* open-source packages`)
  .version("0.1.0");

registerStatusCommand(program);
registerDoctorCommand(program);
registerInitCommand(program);
registerUpdateCommand(program);
registerSyncCommand(program);
registerMcpCommand(program);
registerBackupCommand(program);
registerDbCommand(program);

program.parse();
