import path from "node:path";
import { lstat, readdir } from "node:fs/promises";
import type { FileEntry } from "./types";
import { isOwnedTemporaryDirectory } from "../utils/filesystem";

export class ScanError extends Error {
  constructor(
    public readonly relativePath: string,
    message: string
  ) {
    super(message);
    this.name = "ScanError";
  }
}

export class Scanner {
  constructor(private readonly excludedPaths: string[]) {}

  async scan(root: string): Promise<Map<string, FileEntry>> {
    const entries = new Map<string, FileEntry>();
    await this.scanDirectory(root, "", entries);
    return entries;
  }

  private async scanDirectory(
    root: string,
    relativeDirectory: string,
    entries: Map<string, FileEntry>
  ): Promise<void> {
    const absoluteDirectory = path.join(root, relativeDirectory);
    let children;

    try {
      children = await readdir(absoluteDirectory, { withFileTypes: true });
    } catch (error) {
      if (relativeDirectory !== "" && isMissingPath(error)) return;
      throw new ScanError(relativeDirectory || ".", `扫描失败：${relativeDirectory || root}：${String(error)}`);
    }

    for (const child of children) {
      if (relativeDirectory === "" &&
        await isOwnedTemporaryDirectory(absoluteDirectory, child.name)) {
        continue;
      }

      const relativePath = relativeDirectory
        ? path.join(relativeDirectory, child.name)
        : child.name;
      const normalizedPath = relativePath.split(path.sep).join("/");

      if (this.isExcluded(normalizedPath)) {
        continue;
      }

      const absolutePath = path.join(root, relativePath);
      let metadata;
      try {
        metadata = await lstat(absolutePath);
      } catch (error) {
        if (isMissingPath(error)) continue;
        throw new ScanError(normalizedPath, `读取失败：${normalizedPath}：${String(error)}`);
      }

      if (metadata.isSymbolicLink()) {
        throw new ScanError(normalizedPath, `V1 暂不支持符号链接：${normalizedPath}`);
      }

      if (metadata.isDirectory()) {
        entries.set(normalizedPath, {
          relativePath: normalizedPath,
          absolutePath,
          size: 0,
          modifiedTime: metadata.mtimeMs,
          type: "directory"
        });
        await this.scanDirectory(root, relativePath, entries);
      } else if (metadata.isFile()) {
        entries.set(normalizedPath, {
          relativePath: normalizedPath,
          absolutePath,
          size: metadata.size,
          modifiedTime: metadata.mtimeMs,
          type: "file"
        });
      }
    }
  }

  private isExcluded(relativePath: string): boolean {
    const segments = relativePath.split("/");
    return this.excludedPaths.some((rule) => {
      const normalizedRule = rule.trim().replace(/^\/+|\/+$/g, "");
      return normalizedRule !== "" && (
        relativePath === normalizedRule ||
        relativePath.startsWith(`${normalizedRule}/`) ||
        (!normalizedRule.includes("/") && segments.includes(normalizedRule))
      );
    });
  }
}

function isMissingPath(error: unknown): boolean {
  const code = error instanceof Error
    ? (error as NodeJS.ErrnoException).code
    : undefined;
  return code === "ENOENT" || code === "ENOTDIR";
}
