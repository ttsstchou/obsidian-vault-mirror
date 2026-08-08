import { Modal } from "obsidian";
import type { SyncProgress } from "../sync/types";
import type { Language } from "../i18n";

const PHASE_LABELS: Record<SyncProgress["phase"], string> = {
  "scanning-source": "正在扫描源 Vault",
  "waiting-source-stable": "正在等待源 Vault 文件操作完成",
  "scanning-destination": "正在扫描目标 Vault",
  comparing: "正在比较文件",
  copying: "正在复制新增文件",
  updating: "正在更新文件",
  deleting: "正在删除多余文件",
  verifying: "正在校验文件"
};

const INDETERMINATE_PHASES = new Set<SyncProgress["phase"]>([
  "scanning-source",
  "waiting-source-stable",
  "scanning-destination"
]);

export class SyncProgressModal extends Modal {
  private phaseEl?: HTMLElement;
  private countEl?: HTMLElement;
  private pathEl?: HTMLElement;
  private progressEl?: HTMLElement;
  private progressBarEl?: HTMLElement;

  constructor(app: import("obsidian").App, private readonly language: Language) {
    super(app);
  }

  onOpen(): void {
    this.contentEl.empty();
    this.contentEl.addClass("vault-mirror-modal");
    const zh = this.language === "zh-CN";
    this.contentEl.createEl("h2", { text: zh ? "正在同步到 iCloud…" : "Syncing to iCloud…" });
    this.phaseEl = this.contentEl.createEl("p", { text: zh ? "正在准备同步" : "Preparing sync" });
    this.progressEl = this.contentEl.createDiv({ cls: "vault-mirror-progress" });
    this.progressEl.setAttr("role", "progressbar");
    this.progressEl.setAttr("aria-label", zh ? "同步进度" : "Sync progress");
    this.progressBarEl = this.progressEl.createDiv({ cls: "vault-mirror-progress-bar" });
    this.countEl = this.contentEl.createEl("p", { cls: "vault-mirror-progress-count" });
    this.pathEl = this.contentEl.createEl("code", { cls: "vault-mirror-progress-path" });
    this.setIndeterminate(true);
    this.countEl.setText(zh ? "正在处理，请稍候…" : "Working, please wait…");
  }

  update(progress: SyncProgress): void {
    this.phaseEl?.setText(this.language === "zh-CN" ? PHASE_LABELS[progress.phase] : phaseLabelEn(progress.phase));
    const indeterminate = INDETERMINATE_PHASES.has(progress.phase);
    this.setIndeterminate(indeterminate);
    if (indeterminate) {
      this.countEl?.setText(this.language === "zh-CN" ? "正在处理，请稍候…" : "Working, please wait…");
    } else if (progress.total === 0) {
      this.progressBarEl?.setCssProps({ width: "100%" });
      this.progressEl?.setAttr("aria-valuenow", "100");
      this.countEl?.setText(this.language === "zh-CN" ? "此阶段无需处理文件" : "No files to process in this phase");
    } else {
      const percentage = Math.min(100, Math.round((progress.completed / progress.total) * 100));
      this.progressBarEl?.setCssProps({ width: `${percentage}%` });
      this.progressEl?.setAttr("aria-valuenow", String(percentage));
      this.countEl?.setText(this.language === "zh-CN"
        ? `已处理 ${progress.completed} / ${progress.total} 项（${percentage}%）`
        : `Processed ${progress.completed} / ${progress.total} (${percentage}%)`);
    }
    this.pathEl?.setText(progress.relativePath ?? "");
  }

  private setIndeterminate(indeterminate: boolean): void {
    this.progressEl?.toggleClass("is-indeterminate", indeterminate);
    if (indeterminate) {
      this.progressEl?.removeAttribute("aria-valuenow");
      this.progressBarEl?.setCssProps({ width: "" });
    }
  }
}

function phaseLabelEn(phase: SyncProgress["phase"]): string {
  return {
    "scanning-source": "Scanning source vault",
    "waiting-source-stable": "Waiting for source file operations to finish",
    "scanning-destination": "Scanning destination vault",
    comparing: "Comparing files",
    copying: "Copying new files",
    updating: "Updating files",
    deleting: "Deleting extra files",
    verifying: "Verifying files"
  }[phase];
}
