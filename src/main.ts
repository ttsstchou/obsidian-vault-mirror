import {
  FileSystemAdapter,
  Notice,
  Platform,
  Plugin
} from "obsidian";
import { SyncAlreadyInProgressError, SyncEngine } from "./sync/SyncEngine";
import { SyncExecutionError } from "./sync/SyncExecutor";
import type { SyncError, SyncResult } from "./sync/types";
import { summarizePlan } from "./sync/types";
import {
  DEFAULT_SETTINGS,
  MAX_HISTORY_ENTRIES,
  type SyncHistoryEntry,
  type VaultMirrorSettings
} from "./settings/settings";
import { isMassDeletion } from "./settings/safety";
import { VaultMirrorSettingsTab } from "./settings/SettingsTab";
import { SyncPreviewModal } from "./ui/SyncModal";
import { SyncProgressModal } from "./ui/SyncProgressModal";
import { SyncResultModal } from "./ui/SyncResultModal";
import { ConsoleLogger } from "./utils/logger";
import { errorMessage } from "./utils/path";

interface AppWithSettings {
  setting: {
    open(): void;
    openTabById(id: string): void;
  };
}

export default class VaultMirrorPlugin extends Plugin {
  settings: VaultMirrorSettings = { ...DEFAULT_SETTINGS };
  private readonly engine = new SyncEngine({ logger: new ConsoleLogger() });

  async onload(): Promise<void> {
    await this.loadSettings();

    this.addRibbonIcon("cloud-upload", "同步到 iCloud", () => {
      void this.startSync();
    });

    this.addCommand({
      id: "sync-to-icloud",
      name: "Sync to iCloud",
      callback: () => {
        void this.startSync();
      }
    });

    this.addSettingTab(new VaultMirrorSettingsTab(this.app, this));
  }

  getSourcePath(): string {
    const adapter = this.app.vault.adapter;
    if (!(adapter instanceof FileSystemAdapter)) {
      throw new Error("Vault Mirror 需要使用 Obsidian 桌面端的本地文件系统 Vault。");
    }
    return adapter.getBasePath();
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  private async loadSettings(): Promise<void> {
    const saved = await this.loadData() as Partial<VaultMirrorSettings> | null;
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...saved,
      excludedPaths: saved?.excludedPaths ?? [...DEFAULT_SETTINGS.excludedPaths],
      syncHistory: saved?.syncHistory ?? []
    };
  }

  private async startSync(): Promise<void> {
    if (!Platform.isMacOS) {
      new Notice("Vault Mirror V1 仅支持 macOS 桌面端。");
      return;
    }

    if (this.engine.isRunning()) {
      new Notice("同步正在进行中，请勿重复启动");
      return;
    }

    if (!this.settings.destinationPath) {
      new Notice("请先在 Vault Mirror 设置中选择目标文件夹。", 6000);
      const appWithSettings = this.app as unknown as AppWithSettings;
      appWithSettings.setting.open();
      appWithSettings.setting.openTabById(this.manifest.id);
      return;
    }

    let progressModal = new SyncProgressModal(this.app);
    progressModal.open();
    const startedAt = Date.now();

    try {
      const outcome = await this.engine.sync(
        this.getSourcePath(),
        this.settings.destinationPath,
        {
          excludedPaths: this.settings.excludedPaths,
          strictVerification: this.settings.strictVerification
        },
        {
          progress: (progress) => progressModal.update(progress),
          sourceChanged: (relativePath) => {
            new Notice(`检测到源文件发生变化，正在重新实时扫描：${relativePath}`, 6000);
          },
          confirm: async (plan) => {
            const summary = summarizePlan(plan);
            const firstSync = this.settings.syncHistory.length === 0;
            const massDeletion = isMassDeletion(plan);
            const mustPreview = this.settings.previewBeforeSync ||
              firstSync ||
              summary.deleted > 0 ||
              massDeletion;

            if (!mustPreview) return true;
            progressModal.close();
            const confirmed = await new SyncPreviewModal(this.app, plan, {
              source: this.getSourcePath(),
              destination: this.settings.destinationPath,
              firstSync,
              massDeletionWarning: this.settings.warnOnMassDeletion && massDeletion
            }).waitForChoice();
            if (confirmed) {
              progressModal = new SyncProgressModal(this.app);
              progressModal.open();
            }
            return confirmed;
          }
        }
      );

      progressModal.close();
      if (outcome.status === "cancelled") return;
      await this.recordHistory("success", outcome.result);
      new SyncResultModal(this.app, outcome.result, true).open();
      new Notice("iCloud 镜像同步完成");
    } catch (error) {
      progressModal.close();
      if (error instanceof SyncAlreadyInProgressError) {
        new Notice("同步正在进行中，请勿重复启动");
        return;
      }

      const result = error instanceof SyncExecutionError
        ? error.result
        : failureResult(error, Date.now() - startedAt);
      await this.recordHistory("failed", result);
      new SyncResultModal(this.app, result, false).open();
      new Notice(`Vault Mirror 同步失败：${result.failed[0]?.message ?? errorMessage(error)}`, 10000);
      console.error("[Vault Mirror] Sync failed", error);
    }
  }

  private async recordHistory(
    status: SyncHistoryEntry["status"],
    result: SyncResult
  ): Promise<void> {
    this.settings.syncHistory.unshift({
      timestamp: new Date().toISOString(),
      status,
      created: result.created,
      updated: result.updated,
      deleted: result.deleted,
      skipped: result.skipped,
      duration: result.duration,
      errors: result.failed
    });
    this.settings.syncHistory = this.settings.syncHistory.slice(0, MAX_HISTORY_ENTRIES);
    await this.saveSettings();
  }
}

function failureResult(error: unknown, duration: number): SyncResult {
  const syncError: SyncError = {
    operation: "scan",
    relativePath: ".",
    message: errorMessage(error)
  };
  return {
    created: 0,
    updated: 0,
    deleted: 0,
    skipped: 0,
    failed: [syncError],
    duration
  };
}
