import { Modal } from "obsidian";
import type { SyncProgress } from "../sync/types";

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

  onOpen(): void {
    this.contentEl.empty();
    this.contentEl.addClass("vault-mirror-modal");
    this.contentEl.createEl("h2", { text: "正在同步到 iCloud…" });
    this.phaseEl = this.contentEl.createEl("p", { text: "正在准备同步" });
    this.progressEl = this.contentEl.createDiv({ cls: "vault-mirror-progress" });
    this.progressEl.setAttr("role", "progressbar");
    this.progressEl.setAttr("aria-label", "同步进度");
    this.progressBarEl = this.progressEl.createDiv({ cls: "vault-mirror-progress-bar" });
    this.countEl = this.contentEl.createEl("p", { cls: "vault-mirror-progress-count" });
    this.pathEl = this.contentEl.createEl("code", { cls: "vault-mirror-progress-path" });
    this.setIndeterminate(true);
    this.countEl.setText("正在处理，请稍候…");
  }

  update(progress: SyncProgress): void {
    this.phaseEl?.setText(PHASE_LABELS[progress.phase]);
    const indeterminate = INDETERMINATE_PHASES.has(progress.phase);
    this.setIndeterminate(indeterminate);
    if (indeterminate) {
      this.countEl?.setText("正在处理，请稍候…");
    } else if (progress.total === 0) {
      this.progressBarEl?.style.setProperty("width", "100%");
      this.progressEl?.setAttr("aria-valuenow", "100");
      this.countEl?.setText("此阶段无需处理文件");
    } else {
      const percentage = Math.min(100, Math.round((progress.completed / progress.total) * 100));
      this.progressBarEl?.style.setProperty("width", `${percentage}%`);
      this.progressEl?.setAttr("aria-valuenow", String(percentage));
      this.countEl?.setText(`已处理 ${progress.completed} / ${progress.total} 项（${percentage}%）`);
    }
    this.pathEl?.setText(progress.relativePath ?? "");
  }

  private setIndeterminate(indeterminate: boolean): void {
    this.progressEl?.toggleClass("is-indeterminate", indeterminate);
    if (indeterminate) {
      this.progressEl?.removeAttribute("aria-valuenow");
      this.progressBarEl?.style.removeProperty("width");
    }
  }
}
