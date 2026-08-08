import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  chmod,
  copyFile,
  lstat,
  mkdir,
  readdir,
  rename,
  rmdir,
  rm,
  utimes,
  writeFile
} from "node:fs/promises";
import { hashFile } from "./Comparator";
import type {
  FileEntry,
  SyncError,
  SyncOperation,
  SyncPlan,
  SyncProgress,
  SyncResult
} from "./types";
import { summarizePlan } from "./types";
import { errorMessage } from "../utils/path";
import type { Logger } from "../utils/logger";
import {
  isOwnedTemporaryDirectory,
  TEMP_DIRECTORY_PREFIX,
  TEMP_MARKER_CONTENT,
  TEMP_MARKER_NAME
} from "../utils/filesystem";

export interface ExecutorDependencies {
  copyFile?: (source: string, destination: string) => Promise<void>;
}

export class SyncExecutionError extends Error {
  constructor(
    message: string,
    public readonly result: SyncResult
  ) {
    super(message);
    this.name = "SyncExecutionError";
  }
}

export class SourceChangedDuringSyncError extends Error {
  constructor(public readonly relativePath: string) {
    super(`扫描后源文件发生变化：${relativePath}`);
    this.name = "SourceChangedDuringSyncError";
  }
}

interface BackupEntry {
  destinationPath: string;
  backupPath: string;
}

export class SyncExecutor {
  private readonly copy: (source: string, destination: string) => Promise<void>;

  constructor(
    dependencies: ExecutorDependencies = {},
    private readonly logger?: Logger
  ) {
    this.copy = dependencies.copyFile ?? copyFile;
  }

  async execute(
    plan: SyncPlan,
    destinationRoot: string,
    strictVerification: boolean,
    onProgress?: (progress: SyncProgress) => void
  ): Promise<SyncResult> {
    const startedAt = Date.now();
    const summary = summarizePlan(plan);
    const result: SyncResult = {
      created: 0,
      updated: 0,
      deleted: 0,
      skipped: summary.skipped,
      failed: [],
      duration: 0
    };
    const stagingRoot = path.join(destinationRoot, `${TEMP_DIRECTORY_PREFIX}${randomUUID()}`);
    const payloadRoot = path.join(stagingRoot, "payload");
    const backupRoot = path.join(stagingRoot, "backup");
    const stagedFiles = [...plan.create, ...plan.update].filter(
      (operation) => operation.source?.type === "file"
    );
    const backups: BackupEntry[] = [];
    const placedPaths: string[] = [];

    try {
      await this.cleanupStaleTemporaryDirectories(destinationRoot);
      await mkdir(payloadRoot, { recursive: true });
      await writeFile(
        path.join(stagingRoot, TEMP_MARKER_NAME),
        TEMP_MARKER_CONTENT,
        { flag: "wx" }
      );

      await this.stageFiles(plan.create, payloadRoot, "copying", onProgress);
      await this.stageFiles(plan.update, payloadRoot, "updating", onProgress);

      if (strictVerification) {
        await this.verifyStagedFiles(stagedFiles, payloadRoot, onProgress);
      } else {
        onProgress?.({ phase: "verifying", completed: 0, total: 0 });
      }

      await this.preflightDestination(plan, destinationRoot);

      try {
        for (const operation of plan.update) {
          const destination = requiredDestination(operation);
          const backupPath = path.join(backupRoot, operation.relativePath);
          try {
            await mkdir(path.dirname(backupPath), { recursive: true });
            await rename(destination.absolutePath, backupPath);
          } catch (error) {
            throw new Error(`Failed to update: ${operation.relativePath}: ${errorMessage(error)}`);
          }
          backups.push({ destinationPath: destination.absolutePath, backupPath });
        }

        const directories = [...plan.create, ...plan.update].filter(
          (operation) => operation.source?.type === "directory"
        );
        for (const operation of directories) {
          const destinationPath = path.join(destinationRoot, operation.relativePath);
          try {
            await mkdir(destinationPath, { recursive: true });
          } catch (error) {
            throw new Error(`Failed to update: ${operation.relativePath}: ${errorMessage(error)}`);
          }
          placedPaths.push(destinationPath);
          if (plan.update.includes(operation) && operation.destination?.type === "file") {
            result.updated += 1;
          }
        }

        for (const operation of stagedFiles) {
          const destinationPath = path.join(destinationRoot, operation.relativePath);
          const stagedPath = path.join(payloadRoot, operation.relativePath);
          try {
            await mkdir(path.dirname(destinationPath), { recursive: true });
            await rename(stagedPath, destinationPath);
          } catch (error) {
            const action = plan.create.includes(operation) ? "copy" : "update";
            throw new Error(`Failed to ${action}: ${operation.relativePath}: ${errorMessage(error)}`);
          }
          placedPaths.push(destinationPath);
          if (plan.create.includes(operation)) result.created += 1;
          else result.updated += 1;
        }
      } catch (error) {
        await this.rollback(placedPaths, backups, result);
        throw error;
      }

      await rm(backupRoot, { recursive: true, force: true });
      result.deleted += plan.delete.filter(
        (operation) => operation.coveredByReplacement && operation.type === "file"
      ).length;

      const deletions = plan.delete.filter((operation) => !operation.coveredByReplacement);
      const deletableFiles = deletions.filter((operation) => operation.type === "file");
      const deletableDirectories = deletions.filter((operation) => operation.type === "directory");
      const totalDeletes = deletableFiles.length + deletableDirectories.length;
      let completedDeletes = 0;

      for (const operation of [...deletableFiles, ...deletableDirectories]) {
        onProgress?.({
          phase: "deleting",
          completed: completedDeletes,
          total: totalDeletes,
          relativePath: operation.relativePath
        });
        const destination = requiredDestination(operation);
        try {
          if (operation.type === "directory") {
            await rmdir(destination.absolutePath);
          } else {
            await rm(destination.absolutePath);
            result.deleted += 1;
          }
        } catch (error) {
          throw new Error(`Failed to delete: ${operation.relativePath}: ${errorMessage(error)}`);
        }
        completedDeletes += 1;
      }

      onProgress?.({ phase: "deleting", completed: totalDeletes, total: totalDeletes });
      result.duration = Date.now() - startedAt;
      return result;
    } catch (error) {
      if (error instanceof SourceChangedDuringSyncError) {
        this.logger?.info(error.message);
        throw error;
      }
      if (!(error instanceof SyncExecutionError)) {
        const syncError = makeSyncError(error);
        result.failed.push(syncError);
        this.logger?.error(syncError.message, syncError);
      }
      result.duration = Date.now() - startedAt;
      throw error instanceof SyncExecutionError
        ? error
        : new SyncExecutionError(result.failed.at(-1)?.message ?? "Sync failed", result);
    } finally {
      try {
        await rm(stagingRoot, { recursive: true, force: true });
      } catch (cleanupError) {
        this.logger?.error("Failed to clean temporary sync files", cleanupError);
      }
    }
  }

  private async stageFiles(
    operations: SyncOperation[],
    payloadRoot: string,
    phase: "copying" | "updating",
    onProgress?: (progress: SyncProgress) => void
  ): Promise<void> {
    const files = operations.filter((operation) => operation.source?.type === "file");
    let completed = 0;

    for (const operation of files) {
      const source = requiredSource(operation);
      const stagedPath = path.join(payloadRoot, operation.relativePath);
      onProgress?.({ phase, completed, total: files.length, relativePath: operation.relativePath });
      try {
        await mkdir(path.dirname(stagedPath), { recursive: true });
        await this.copy(source.absolutePath, stagedPath);
        const sourceStat = await lstat(source.absolutePath);
        const stagedStat = await lstat(stagedPath);
        if (!sourceStat.isFile() || !stagedStat.isFile() || sourceStat.size !== stagedStat.size) {
          throw new Error("Copied file size does not match the source");
        }
        await chmod(stagedPath, sourceStat.mode);
        await utimes(stagedPath, sourceStat.atime, sourceStat.mtime);
      } catch (error) {
        if (isMissingOrChangedSource(error)) {
          throw new SourceChangedDuringSyncError(operation.relativePath);
        }
        throw new Error(`Failed to ${phase === "copying" ? "copy" : "update"}: ${operation.relativePath}: ${errorMessage(error)}`);
      }
      completed += 1;
    }
    onProgress?.({ phase, completed, total: files.length });
  }

  private async verifyStagedFiles(
    operations: SyncOperation[],
    payloadRoot: string,
    onProgress?: (progress: SyncProgress) => void
  ): Promise<void> {
    let completed = 0;
    for (const operation of operations) {
      const source = requiredSource(operation);
      onProgress?.({
        phase: "verifying",
        completed,
        total: operations.length,
        relativePath: operation.relativePath
      });
      const [sourceHash, stagedHash] = await Promise.all([
        hashFile(source.absolutePath),
        hashFile(path.join(payloadRoot, operation.relativePath))
      ]);
      if (sourceHash !== stagedHash) {
        throw new Error(`Failed to verify: ${operation.relativePath}`);
      }
      completed += 1;
    }
    onProgress?.({ phase: "verifying", completed, total: operations.length });
  }

  private async preflightDestination(plan: SyncPlan, destinationRoot: string): Promise<void> {
    for (const operation of [...plan.update, ...plan.delete]) {
      const destination = requiredDestination(operation);
      if (!(await matchesSnapshot(destination))) {
        throw new Error(`Destination changed during sync: ${operation.relativePath}`);
      }
    }

    for (const operation of plan.create) {
      const destinationPath = path.join(destinationRoot, operation.relativePath);
      try {
        await lstat(destinationPath);
        throw new Error(`Destination changed during sync: ${operation.relativePath}`);
      } catch (error) {
        if (error instanceof Error && "code" in error &&
          (error.code === "ENOENT" || error.code === "ENOTDIR")) {
          continue;
        }
        throw error;
      }
    }
  }

  private async rollback(
    placedPaths: string[],
    backups: BackupEntry[],
    result: SyncResult
  ): Promise<void> {
    try {
      for (const placedPath of [...placedPaths].sort((a, b) => b.length - a.length)) {
        await rm(placedPath, { recursive: true, force: true });
      }
      for (const backup of [...backups].reverse()) {
        await mkdir(path.dirname(backup.destinationPath), { recursive: true });
        await rename(backup.backupPath, backup.destinationPath);
      }
      result.created = 0;
      result.updated = 0;
    } catch (error) {
      result.failed.push({
        operation: "update",
        relativePath: ".",
        message: `Rollback failed: ${errorMessage(error)}`
      });
    }
  }

  private async cleanupStaleTemporaryDirectories(destinationRoot: string): Promise<void> {
    const children = await readdir(destinationRoot, { withFileTypes: true });
    for (const child of children) {
      if (child.isDirectory() &&
        await isOwnedTemporaryDirectory(destinationRoot, child.name)) {
        await rm(path.join(destinationRoot, child.name), { recursive: true, force: true });
      }
    }
  }
}

function requiredSource(operation: SyncOperation): FileEntry {
  if (!operation.source) throw new Error(`Missing source entry: ${operation.relativePath}`);
  return operation.source;
}

function requiredDestination(operation: SyncOperation): FileEntry {
  if (!operation.destination) throw new Error(`Missing destination entry: ${operation.relativePath}`);
  return operation.destination;
}

async function matchesSnapshot(entry: FileEntry): Promise<boolean> {
  try {
    const current = await lstat(entry.absolutePath);
    const currentType = current.isDirectory() ? "directory" : current.isFile() ? "file" : undefined;
    return currentType === entry.type &&
      (entry.type === "directory" || current.size === entry.size) &&
      current.mtimeMs === entry.modifiedTime;
  } catch {
    return false;
  }
}

function makeSyncError(error: unknown): SyncError {
  const message = errorMessage(error);
  const pathMatch = message.match(/(?:copy|update|delete|verify|sync): ([^:]+)(?::|$)/i);
  let operation: SyncError["operation"] = "scan";
  if (/copy/i.test(message)) operation = "copy";
  else if (/update|rollback/i.test(message)) operation = "update";
  else if (/delete|directory not empty|ENOTEMPTY/i.test(message)) operation = "delete";
  else if (/verify/i.test(message)) operation = "verify";
  return { operation, relativePath: pathMatch?.[1] ?? ".", message };
}

function isMissingOrChangedSource(error: unknown): boolean {
  const code = error instanceof Error
    ? (error as NodeJS.ErrnoException).code
    : undefined;
  return code === "ENOENT" || code === "ENOTDIR" || code === "EISDIR";
}
