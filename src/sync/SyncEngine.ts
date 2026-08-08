import { access, constants } from "node:fs/promises";
import { Scanner } from "./Scanner";
import { FileComparator } from "./Comparator";
import { SyncPlanner } from "./SyncPlanner";
import { SourceChangedDuringSyncError, SyncExecutor } from "./SyncExecutor";
import type {
  SyncCallbacks,
  SyncOptions,
  SyncOutcome,
  SyncPlan
} from "./types";
import { validateMirrorPaths } from "../utils/path";
import type { Logger } from "../utils/logger";

export class SyncAlreadyInProgressError extends Error {
  constructor() {
    super("同步正在进行中，请勿重复启动");
    this.name = "SyncAlreadyInProgressError";
  }
}

export interface SyncEngineDependencies {
  executor?: SyncExecutor;
  logger?: Logger;
  sourceStabilityDelayMs?: number;
}

const DEFAULT_SOURCE_STABILITY_DELAY_MS = 1500;
const MAX_SOURCE_STABILITY_CHECKS = 10;

export class SyncEngine {
  private running = false;
  private readonly executor: SyncExecutor;
  private readonly logger?: Logger;
  private readonly sourceStabilityDelayMs: number;

  constructor(dependencies: SyncEngineDependencies = {}) {
    this.executor = dependencies.executor ?? new SyncExecutor({}, dependencies.logger);
    this.logger = dependencies.logger;
    this.sourceStabilityDelayMs = dependencies.sourceStabilityDelayMs ?? DEFAULT_SOURCE_STABILITY_DELAY_MS;
  }

  isRunning(): boolean {
    return this.running;
  }

  async sync(
    sourcePath: string,
    destinationPath: string,
    options: SyncOptions,
    callbacks: SyncCallbacks
  ): Promise<SyncOutcome> {
    if (this.running) throw new SyncAlreadyInProgressError();
    this.running = true;

    try {
      const paths = await validateMirrorPaths(sourcePath, destinationPath);
      await access(paths.destination, constants.R_OK | constants.W_OK);
      let sourceChangeRetries = 0;

      while (true) {
        const scanner = new Scanner(options.excludedPaths);
        const sourceEntries = await this.scanStableSource(scanner, paths.source, callbacks);
        callbacks.progress?.({ phase: "scanning-destination", completed: 0, total: 0 });
        const destinationEntries = await scanner.scan(paths.destination);
        const planner = new SyncPlanner(new FileComparator(options.strictVerification));
        const plan: SyncPlan = await planner.createPlan(
          sourceEntries,
          destinationEntries,
          (completed, total, relativePath) => callbacks.progress?.({
            phase: "comparing",
            completed,
            total,
            relativePath
          })
        );
        const confirmed = await callbacks.confirm(plan);
        if (!confirmed) return { status: "cancelled", plan };

        try {
          const result = await this.executor.execute(
            plan,
            paths.destination,
            options.strictVerification,
            callbacks.progress
          );
          this.logger?.info("Sync completed", result);
          return { status: "completed", plan, result };
        } catch (error) {
          if (error instanceof SourceChangedDuringSyncError && sourceChangeRetries < 2) {
            sourceChangeRetries += 1;
            callbacks.sourceChanged?.(error.relativePath);
            continue;
          }
          throw error;
        }
      }
    } finally {
      this.running = false;
    }
  }

  private async scanStableSource(
    scanner: Scanner,
    sourcePath: string,
    callbacks: SyncCallbacks
  ): Promise<Awaited<ReturnType<Scanner["scan"]>>> {
    callbacks.progress?.({ phase: "scanning-source", completed: 0, total: 0 });
    let previousEntries = await scanner.scan(sourcePath);

    for (let check = 0; check < MAX_SOURCE_STABILITY_CHECKS; check += 1) {
      callbacks.progress?.({ phase: "waiting-source-stable", completed: 0, total: 0 });
      await delay(this.sourceStabilityDelayMs);
      callbacks.progress?.({ phase: "scanning-source", completed: 0, total: 0 });
      const currentEntries = await scanner.scan(sourcePath);
      if (sameSnapshot(previousEntries, currentEntries)) return currentEntries;
      previousEntries = currentEntries;
    }

    throw new Error("源 Vault 持续发生变化，请等待百度网盘完成文件操作后重试。");
  }
}

function sameSnapshot(
  first: Awaited<ReturnType<Scanner["scan"]>>,
  second: Awaited<ReturnType<Scanner["scan"]>>
): boolean {
  if (first.size !== second.size) return false;
  for (const [relativePath, firstEntry] of first) {
    const secondEntry = second.get(relativePath);
    if (!secondEntry ||
      firstEntry.type !== secondEntry.type ||
      firstEntry.size !== secondEntry.size ||
      firstEntry.modifiedTime !== secondEntry.modifiedTime) {
      return false;
    }
  }
  return true;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
