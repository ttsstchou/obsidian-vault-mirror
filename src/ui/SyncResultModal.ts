import { App, Modal, Setting } from "obsidian";
import type { SyncResult } from "../sync/types";

export class SyncResultModal extends Modal {
  constructor(
    app: App,
    private readonly result: SyncResult,
    private readonly successful: boolean
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("vault-mirror-modal");
    contentEl.createEl("h2", { text: this.successful ? "同步完成" : "同步失败" });

    const stats = contentEl.createDiv({ cls: "vault-mirror-stats" });
    addStat(stats, "新增", this.result.created);
    addStat(stats, "更新", this.result.updated);
    addStat(stats, "删除", this.result.deleted);
    addStat(stats, "跳过", this.result.skipped);
    addStat(stats, "失败", this.result.failed.length);
    addStat(stats, "耗时", `${(this.result.duration / 1000).toFixed(1)} 秒`);

    if (this.result.failed.length > 0) {
      const errors = contentEl.createDiv({ cls: "vault-mirror-errors" });
      errors.createEl("h3", { text: "错误详情" });
      for (const error of this.result.failed) {
        errors.createEl("code", { text: error.message });
      }
    }

    new Setting(contentEl).addButton((button) => button
      .setButtonText("关闭")
      .setCta()
      .onClick(() => this.close()));
  }
}

function addStat(container: HTMLElement, label: string, value: string | number): void {
  const row = container.createDiv({ cls: "vault-mirror-stat" });
  row.createSpan({ text: label });
  row.createEl("strong", { text: String(value) });
}
