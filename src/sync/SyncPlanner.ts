import type { FileEntry, SyncOperation, SyncPlan } from "./types";
import { FileComparator } from "./Comparator";

export class SyncPlanner {
  constructor(private readonly comparator: FileComparator) {}

  async createPlan(
    sourceEntries: Map<string, FileEntry>,
    destinationEntries: Map<string, FileEntry>,
    onProgress?: (completed: number, total: number, relativePath?: string) => void
  ): Promise<SyncPlan> {
    const plan: SyncPlan = {
      create: [],
      update: [],
      delete: [],
      skip: [],
      destinationFileCount: countFiles(destinationEntries)
    };
    const replacedDestinationDirectories: string[] = [];
    const total = sourceEntries.size + destinationEntries.size;
    let completed = 0;
    onProgress?.(completed, total);

    for (const [relativePath, source] of sourceEntries) {
      const destination = destinationEntries.get(relativePath);
      const operation: SyncOperation = {
        relativePath,
        source,
        destination,
        type: source.type
      };

      if (!destination) {
        plan.create.push(operation);
      } else if (source.type !== destination.type) {
        plan.update.push(operation);
        if (destination.type === "directory") {
          replacedDestinationDirectories.push(relativePath);
        }
      } else if (source.type === "directory") {
        plan.skip.push(operation);
      } else if (await this.comparator.areEqual(source, destination)) {
        plan.skip.push(operation);
      } else {
        plan.update.push(operation);
      }
      completed += 1;
      onProgress?.(completed, total, relativePath);
    }

    for (const [relativePath, destination] of destinationEntries) {
      if (sourceEntries.has(relativePath)) {
        completed += 1;
        onProgress?.(completed, total, relativePath);
        continue;
      }
      plan.delete.push({
        relativePath,
        destination,
        type: destination.type,
        coveredByReplacement: hasAncestor(relativePath, replacedDestinationDirectories)
      });
      completed += 1;
      onProgress?.(completed, total, relativePath);
    }

    plan.create.sort(shallowestFirst);
    plan.update.sort(shallowestFirst);
    plan.delete.sort(deepestFirst);
    return plan;
  }
}

function countFiles(entries: Map<string, FileEntry>): number {
  let count = 0;
  for (const entry of entries.values()) {
    if (entry.type === "file") count += 1;
  }
  return count;
}

function hasAncestor(relativePath: string, ancestors: string[]): boolean {
  return ancestors.some((ancestor) => relativePath.startsWith(`${ancestor}/`));
}

function depth(relativePath: string): number {
  return relativePath.split("/").length;
}

function shallowestFirst(a: SyncOperation, b: SyncOperation): number {
  return depth(a.relativePath) - depth(b.relativePath) || a.relativePath.localeCompare(b.relativePath);
}

function deepestFirst(a: SyncOperation, b: SyncOperation): number {
  return depth(b.relativePath) - depth(a.relativePath) || b.relativePath.localeCompare(a.relativePath);
}
