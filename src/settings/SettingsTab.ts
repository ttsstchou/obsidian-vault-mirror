import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type VaultMirrorPlugin from "../main";
import { chooseDestinationFolder } from "../utils/folderPicker";
import { validateMirrorPaths } from "../utils/path";

export class VaultMirrorSettingsTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: VaultMirrorPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Vault Mirror" });
    containerEl.createEl("p", {
      cls: "vault-mirror-warning",
      text: "Vault Mirror 目前仅支持单向同步。仅在目标 Vault 中进行的修改，可能会在下次同步时被覆盖。"
    });

    new Setting(containerEl)
      .setName("源 Vault")
      .setDesc(`${this.plugin.getSourcePath()} · 当前 Vault`);

    new Setting(containerEl)
      .setName("目标文件夹")
      .setDesc(this.plugin.settings.destinationPath || "尚未选择目标文件夹")
      .addButton((button) => button
        .setButtonText(this.plugin.settings.destinationPath ? "更改" : "选择文件夹")
        .setCta()
        .onClick(async () => {
          try {
            const chosen = await chooseDestinationFolder();
            if (!chosen) return;
            await validateMirrorPaths(this.plugin.getSourcePath(), chosen);
            this.plugin.settings.destinationPath = chosen;
            await this.plugin.saveSettings();
            this.display();
          } catch (error) {
            new Notice(error instanceof Error ? error.message : String(error), 8000);
          }
        }));

    containerEl.createEl("h3", { text: "安全" });
    new Setting(containerEl)
      .setName("同步前预览")
      .setDesc("执行同步前显示文件变更摘要。")
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.previewBeforeSync)
        .onChange(async (value) => {
          this.plugin.settings.previewBeforeSync = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("大量删除警告")
      .setDesc("删除超过 10 个文件或目标文件总数的 10% 时显示醒目警告。")
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.warnOnMassDeletion)
        .onChange(async (value) => {
          this.plugin.settings.warnOnMassDeletion = value;
          await this.plugin.saveSettings();
        }));

    containerEl.createEl("h3", { text: "校验" });
    new Setting(containerEl)
      .setName("严格文件校验")
      .setDesc("使用 SHA-256 比较并校验暂存副本。大型 Vault 的同步速度会变慢。")
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.strictVerification)
        .onChange(async (value) => {
          this.plugin.settings.strictVerification = value;
          await this.plugin.saveSettings();
        }));

    containerEl.createEl("h3", { text: "高级" });
    new Setting(containerEl)
      .setName("排除的文件")
      .setDesc("每行填写一个相对路径，或准确的文件/文件夹名称。默认不会排除 .obsidian。")
      .addTextArea((text) => {
        text.setValue(this.plugin.settings.excludedPaths.join("\n"));
        text.inputEl.rows = 4;
        text.onChange(async (value) => {
          this.plugin.settings.excludedPaths = value
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean);
          await this.plugin.saveSettings();
        });
      });

    containerEl.createEl("h3", { text: "同步历史" });
    if (this.plugin.settings.syncHistory.length === 0) {
      containerEl.createEl("p", { text: "暂无同步记录。" });
      return;
    }

    for (const item of this.plugin.settings.syncHistory) {
      const entry = containerEl.createDiv({ cls: "vault-mirror-history" });
      entry.createEl("strong", {
        text: `${new Date(item.timestamp).toLocaleString("zh-CN")} · ${item.status === "success" ? "成功" : "失败"}`
      });
      entry.createEl("span", {
        text: `新增 ${item.created} · 更新 ${item.updated} · 删除 ${item.deleted} · 跳过 ${item.skipped} · ${(item.duration / 1000).toFixed(1)} 秒`
      });
      if (item.errors[0]) entry.createEl("code", { text: item.errors[0].message });
    }
  }
}
