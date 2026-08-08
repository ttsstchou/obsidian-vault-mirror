import { App, Modal, Setting } from "obsidian";
import type { SyncResult } from "../sync/types";
import type { Language } from "../i18n";

export class SyncResultModal extends Modal {
  constructor(
    app: App,
    private readonly result: SyncResult,
    private readonly successful: boolean,
    private readonly language: Language
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("vault-mirror-modal");
    const zh = this.language === "zh-CN";
    contentEl.createEl("h2", { text: this.successful ? (zh ? "同步完成" : "Sync complete") : (zh ? "同步失败" : "Sync failed") });

    const stats = contentEl.createDiv({ cls: "vault-mirror-stats" });
    addStat(stats, zh ? "新增" : "Created", this.result.created);
    addStat(stats, zh ? "更新" : "Updated", this.result.updated);
    addStat(stats, zh ? "删除" : "Deleted", this.result.deleted);
    addStat(stats, zh ? "跳过" : "Skipped", this.result.skipped);
    addStat(stats, zh ? "失败" : "Failed", this.result.failed.length);
    addStat(stats, zh ? "耗时" : "Duration", `${(this.result.duration / 1000).toFixed(1)} ${zh ? "秒" : "s"}`);

    if (this.result.failed.length > 0) {
      const errors = contentEl.createDiv({ cls: "vault-mirror-errors" });
      errors.createEl("h3", { text: zh ? "错误详情" : "Error details" });
      for (const error of this.result.failed) {
        errors.createEl("code", { text: error.message });
      }
    }

    new Setting(contentEl).addButton((button) => button
      .setButtonText(zh ? "关闭" : "Close")
      .setCta()
      .onClick(() => this.close()));
  }
}

function addStat(container: HTMLElement, label: string, value: string | number): void {
  const row = container.createDiv({ cls: "vault-mirror-stat" });
  row.createSpan({ text: label });
  row.createEl("strong", { text: String(value) });
}
