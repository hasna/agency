import { describe, expect, it } from "bun:test";
import { formatBytes, pad, truncate, HASNA_HOME, dataPath } from "./utils";
import { homedir } from "node:os";
import { join } from "node:path";

describe("utils", () => {
  describe("formatBytes", () => {
    it("formats 0 bytes", () => {
      expect(formatBytes(0)).toBe("0 B");
    });

    it("formats bytes", () => {
      expect(formatBytes(512)).toBe("512 B");
    });

    it("formats kilobytes", () => {
      expect(formatBytes(1024)).toBe("1.0 KB");
    });

    it("formats megabytes", () => {
      expect(formatBytes(1048576)).toBe("1.0 MB");
    });

    it("formats gigabytes", () => {
      expect(formatBytes(1073741824)).toBe("1.0 GB");
    });
  });

  describe("pad", () => {
    it("pads shorter strings", () => {
      expect(pad("hi", 5)).toBe("hi   ");
    });

    it("truncates longer strings", () => {
      expect(pad("hello world", 5)).toBe("hello");
    });

    it("returns exact width", () => {
      expect(pad("exact", 5)).toBe("exact");
    });
  });

  describe("truncate", () => {
    it("leaves short strings alone", () => {
      expect(truncate("hi", 10)).toBe("hi");
    });

    it("truncates long strings with ellipsis", () => {
      const result = truncate("hello world", 6);
      expect(result.length).toBe(6);
      expect(result.endsWith("\u2026")).toBe(true);
    });
  });

  describe("paths", () => {
    it("HASNA_HOME points to ~/.hasna", () => {
      expect(HASNA_HOME).toBe(join(homedir(), ".hasna"));
    });

    it("dataPath returns correct path", () => {
      expect(dataPath("todos")).toBe(join(homedir(), ".hasna", "todos"));
    });
  });
});
