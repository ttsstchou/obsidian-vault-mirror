import { App, Modal, Setting } from "obsidian";
import type { SyncPlan } from "../sync/types";
import { summarizeNoteChanges, summarizePlan } from "../sync/types";

export interface PreviewOptions {
  source: string;
  destination: string;
  massDeletionWarning: boolean;
  firstSync: boolean;
}

export class SyncPreviewModal extends Modal {
  private resolve?: (confirmed: boolean) => void;
  private settled = false;

  constructor(
    app: App,
    private readonly plan: SyncPlan,
    private readonly options: PreviewOptions
  ) {
    super(app);
  }

  waitForChoice(): Promise<boolean> {
    return new Promise((resolve) => {
      this.resolve = resolve;
      this.open();
    });
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("vault-mirror-modal");
    contentEl.createEl("h2", { text: "同步到 iCloud" });
    addPath(contentEl, "源 Vault · 当前 Vault", this.options.source);
    addPath(contentEl, "目标 Vault", this.options.destination);

    const summary = summarizePlan(this.plan);
    const totalChanges = summary.created + summary.updated + summary.deleted;
    const noteChanges = summarizeNoteChanges(this.plan);
    const scanSummary = contentEl.createDiv({ cls: "vault-mirror-scan-summary" });
    scanSummary.createEl("span", {
      cls: "vault-mirror-scan-label",
      text: "本次实时扫描发现"
    });
    const totalRow = scanSummary.createDiv({ cls: "vault-mirror-change-total" });
    totalRow.createEl("strong", { text: String(noteChanges.total) });
    totalRow.createSpan({ text: "篇笔记变更" });
    scanSummary.createEl("span", {
      cls: "vault-mirror-note-breakdown",
      text: `新增 ${noteChanges.created} · 更新 ${noteChanges.updated} · 删除 ${noteChanges.deleted}`
    });
    scanSummary.createEl("span", {
      cls: "vault-mirror-file-total",
      text: `全部文件变更：${totalChanges} 项（包含附件、Vault 配置及其他文件）`
    });
    scanSummary.createEl("span", {
      cls: "vault-mirror-scan-time",
      text: `扫描完成时间：${new Date().toLocaleString("zh-CN")}`
    });

    if (this.options.firstSync) {
      contentEl.createEl("p", {
        cls: "vault-mirror-notice",
        text: "这是首次同步，请仔细确认目标路径和文件变更。"
      });
    }

    if (this.options.massDeletionWarning) {
      contentEl.createEl("p", {
        cls: "vault-mirror-warning",
        text: `此次同步将从 iCloud 镜像中删除 ${summary.deleted} 个文件。`
      });
    }

    const stats = contentEl.createDiv({ cls: "vault-mirror-stats" });
    addStat(stats, "新增文件", summary.created);
    addStat(stats, "更新文件", summary.updated);
    addStat(stats, "删除文件", summary.deleted);
    addStat(stats, "未变更", summary.skipped);

    this.addDetails(contentEl, "新增", this.plan.create);
    this.addDetails(contentEl, "更新", this.plan.update);
    this.addDetails(contentEl, "删除", this.plan.delete);

    new Setting(contentEl)
      .addButton((button) => button
        .setButtonText("取消")
        .onClick(() => this.finish(false)))
      .addButton((button) => button
        .setButtonText("开始同步")
        .setCta()
        .onClick(() => this.finish(true)));
  }

  onClose(): void {
    this.contentEl.empty();
    if (!this.settled) {
      this.settled = true;
      this.resolve?.(false);
    }
  }

  private finish(confirmed: boolean): void {
    if (this.settled) return;
    this.settled = true;
    this.resolve?.(confirmed);
    this.close();
  }

  private addDetails(
    container: HTMLElement,
    label: string,
    operations: SyncPlan["create"]
  ): void {
    if (operations.length === 0) return;
    const details = container.createEl("details", { cls: "vault-mirror-details" });
    details.createEl("summary", { text: `${label} (${operations.length})` });
    const list = details.createEl("ul");
    for (const operation of operations.slice(0, 100)) {
      list.createEl("li", { text: operation.relativePath });
    }
    if (operations.length > 100) {
      list.createEl("li", { text: `……另有 ${operations.length - 100} 项` });
    }
  }
}

function addPath(container: HTMLElement, label: string, value: string): void {
  const block = container.createDiv({ cls: "vault-mirror-path-block" });
  block.createEl("strong", { text: label });
  block.createEl("code", { text: value });
}

function addStat(container: HTMLElement, label: string, value: number): void {
  const row = container.createDiv({ cls: "vault-mirror-stat" });
  row.createSpan({ text: label });
  row.createEl("strong", { text: String(value) });
}
