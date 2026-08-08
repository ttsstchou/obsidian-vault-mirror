import { App, Modal, Setting } from "obsidian";
import type { SyncPlan } from "../sync/types";
import { summarizeNoteChanges, summarizePlan } from "../sync/types";
import { dateLocale, type Language } from "../i18n";

export interface PreviewOptions {
  source: string;
  destination: string;
  massDeletionWarning: boolean;
  firstSync: boolean;
  language: Language;
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
    const zh = this.options.language === "zh-CN";
    contentEl.createEl("h2", { text: zh ? "同步到 iCloud" : "Sync to iCloud" });
    addPath(contentEl, zh ? "源 Vault · 当前 Vault" : "Source vault · Current vault", this.options.source);
    addPath(contentEl, zh ? "目标 Vault" : "Destination vault", this.options.destination);

    const summary = summarizePlan(this.plan);
    const totalChanges = summary.created + summary.updated + summary.deleted;
    const noteChanges = summarizeNoteChanges(this.plan);
    const scanSummary = contentEl.createDiv({ cls: "vault-mirror-scan-summary" });
    scanSummary.createEl("span", {
      cls: "vault-mirror-scan-label",
      text: zh ? "本次实时扫描发现" : "Live scan found"
    });
    const totalRow = scanSummary.createDiv({ cls: "vault-mirror-change-total" });
    totalRow.createEl("strong", { text: String(noteChanges.total) });
    totalRow.createSpan({ text: zh ? "篇笔记变更" : " changed notes" });
    scanSummary.createEl("span", {
      cls: "vault-mirror-note-breakdown",
      text: zh
        ? `新增 ${noteChanges.created} · 更新 ${noteChanges.updated} · 删除 ${noteChanges.deleted}`
        : `Created ${noteChanges.created} · Updated ${noteChanges.updated} · Deleted ${noteChanges.deleted}`
    });
    scanSummary.createEl("span", {
      cls: "vault-mirror-file-total",
      text: zh
        ? `全部文件变更：${totalChanges} 项（包含附件、Vault 配置及其他文件）`
        : `All file changes: ${totalChanges} (including attachments, Vault settings, and other files)`
    });
    scanSummary.createEl("span", {
      cls: "vault-mirror-scan-time",
      text: `${zh ? "扫描完成时间" : "Scan completed"}: ${new Date().toLocaleString(dateLocale(this.options.language))}`
    });

    if (this.options.firstSync) {
      contentEl.createEl("p", {
        cls: "vault-mirror-notice",
        text: zh ? "这是首次同步，请仔细确认目标路径和文件变更。" : "This is the first sync. Carefully confirm the destination path and file changes."
      });
    }

    if (this.options.massDeletionWarning) {
      contentEl.createEl("p", {
        cls: "vault-mirror-warning",
        text: zh ? `此次同步将从 iCloud 镜像中删除 ${summary.deleted} 个文件。` : `This sync will delete ${summary.deleted} files from the destination mirror.`
      });
    }

    const stats = contentEl.createDiv({ cls: "vault-mirror-stats" });
    addStat(stats, zh ? "新增文件" : "Created files", summary.created);
    addStat(stats, zh ? "更新文件" : "Updated files", summary.updated);
    addStat(stats, zh ? "删除文件" : "Deleted files", summary.deleted);
    addStat(stats, zh ? "未变更" : "Unchanged", summary.skipped);

    this.addDetails(contentEl, zh ? "新增" : "Created", this.plan.create);
    this.addDetails(contentEl, zh ? "更新" : "Updated", this.plan.update);
    this.addDetails(contentEl, zh ? "删除" : "Deleted", this.plan.delete);

    new Setting(contentEl)
      .addButton((button) => button
        .setButtonText(zh ? "取消" : "Cancel")
        .onClick(() => this.finish(false)))
      .addButton((button) => button
        .setButtonText(zh ? "开始同步" : "Start sync")
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
      list.createEl("li", { text: this.options.language === "zh-CN" ? `……另有 ${operations.length - 100} 项` : `…and ${operations.length - 100} more` });
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
