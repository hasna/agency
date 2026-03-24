/**
 * Re-export the shared registry from the monorepo root.
 * This wrapper allows web code to import from @/lib/registry
 * while the actual data lives in ../../src/registry.ts
 */

export type { HasnaPackage } from "../../../src/registry";
export {
  REGISTRY,
  PACKAGE_COUNT,
  findPackage,
  mcpPackages,
  dbPackages,
  httpPackages,
} from "../../../src/registry";
