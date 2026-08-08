import type { SyncError } from "../sync/types";
import type { Language } from "../i18n";

export interface SyncHistoryEntry {
  timestamp: string;
  status: "success" | "failed";
  created: number;
  updated: number;
  deleted: number;
  skipped: number;
  duration: number;
  errors: SyncError[];
}

export interface VaultMirrorSettings {
  language: Language;
  destinationPath: string;
  previewBeforeSync: boolean;
  warnOnMassDeletion: boolean;
  strictVerification: boolean;
  excludedPaths: string[];
  syncHistory: SyncHistoryEntry[];
}

export const DEFAULT_SETTINGS: VaultMirrorSettings = {
  language: "zh-CN",
  destinationPath: "",
  previewBeforeSync: true,
  warnOnMassDeletion: true,
  strictVerification: false,
  excludedPaths: [".DS_Store"],
  syncHistory: []
};

export const MAX_HISTORY_ENTRIES = 20;
export const DELETE_WARNING_COUNT = 10;
export const DELETE_WARNING_PERCENTAGE = 0.1;
