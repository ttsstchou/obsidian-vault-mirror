export type EntryType = "file" | "directory";

export interface FileEntry {
  relativePath: string;
  absolutePath: string;
  size: number;
  modifiedTime: number;
  type: EntryType;
}

export interface SyncOperation {
  relativePath: string;
  source?: FileEntry;
  destination?: FileEntry;
  type: EntryType;
  coveredByReplacement?: boolean;
}

export interface SyncPlan {
  create: SyncOperation[];
  update: SyncOperation[];
  delete: SyncOperation[];
  skip: SyncOperation[];
  destinationFileCount: number;
}

export interface SyncError {
  operation: "scan" | "copy" | "update" | "delete" | "verify";
  relativePath: string;
  message: string;
}

export interface SyncResult {
  created: number;
  updated: number;
  deleted: number;
  skipped: number;
  failed: SyncError[];
  duration: number;
}

export type SyncPhase =
  | "scanning-source"
  | "waiting-source-stable"
  | "scanning-destination"
  | "comparing"
  | "copying"
  | "updating"
  | "deleting"
  | "verifying";

export interface SyncProgress {
  phase: SyncPhase;
  completed: number;
  total: number;
  relativePath?: string;
}

export interface SyncOptions {
  excludedPaths: string[];
  strictVerification: boolean;
}

export interface SyncCallbacks {
  confirm: (plan: SyncPlan) => Promise<boolean>;
  progress?: (progress: SyncProgress) => void;
  sourceChanged?: (relativePath: string) => void;
}

export type SyncOutcome =
  | { status: "cancelled"; plan: SyncPlan }
  | { status: "completed"; plan: SyncPlan; result: SyncResult };

export interface PlanSummary {
  created: number;
  updated: number;
  deleted: number;
  skipped: number;
}

export interface NoteChangeSummary {
  created: number;
  updated: number;
  deleted: number;
  total: number;
}

export function summarizePlan(plan: SyncPlan): PlanSummary {
  const fileCount = (operations: SyncOperation[]) =>
    operations.filter((operation) => operation.type === "file").length;
  const updatedFileCount = plan.update.filter((operation) =>
    operation.source?.type === "file" || operation.destination?.type === "file"
  ).length;

  return {
    created: fileCount(plan.create),
    updated: updatedFileCount,
    deleted: fileCount(plan.delete),
    skipped: fileCount(plan.skip)
  };
}

export function summarizeNoteChanges(plan: SyncPlan): NoteChangeSummary {
  const countNotes = (operations: SyncOperation[]) => operations.filter(isNote).length;
  const created = countNotes(plan.create);
  const updated = countNotes(plan.update);
  const deleted = countNotes(plan.delete);
  return { created, updated, deleted, total: created + updated + deleted };
}

function isNote(operation: SyncOperation): boolean {
  const normalizedPath = operation.relativePath.toLowerCase();
  return normalizedPath.endsWith(".md") &&
    !normalizedPath.startsWith(".obsidian/") &&
    operation.type === "file";
}
