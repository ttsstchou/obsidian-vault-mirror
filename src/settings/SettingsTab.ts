import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type VaultMirrorPlugin from "../main";
import { chooseDestinationFolder } from "../utils/folderPicker";
import { validateMirrorPaths } from "../utils/path";
import { dateLocale, t } from "../i18n";

export class VaultMirrorSettingsTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: VaultMirrorPlugin) {
    super(app, plugin);
  }

  display(): void {
    const language = this.plugin.settings.language;
    const text = (key: Parameters<typeof t>[1]) => t(language, key);
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Vault Mirror" });
    containerEl.createEl("p", {
      cls: "vault-mirror-warning",
      text: language === "zh-CN"
        ? "Vault Mirror 目前仅支持单向同步。仅在目标 Vault 中进行的修改，可能会在下次同步时被覆盖。"
        : "Vault Mirror is one-way only. Changes made only in the destination vault may be overwritten by the next sync."
    });

    new Setting(containerEl)
      .setName(text("language"))
      .setDesc(text("languageDescription"))
      .addDropdown((dropdown) => dropdown
        .addOption("zh-CN", text("chinese"))
        .addOption("en", text("english"))
        .setValue(language)
        .onChange(async (value) => {
          this.plugin.settings.language = value === "en" ? "en" : "zh-CN";
          await this.plugin.saveSettings();
          this.display();
        }));

    new Setting(containerEl)
      .setName(text("sourceVault"))
      .setDesc(`${this.plugin.getSourcePath()} · ${text("currentVault")}`);

    new Setting(containerEl)
      .setName(text("destinationFolder"))
      .setDesc(this.plugin.settings.destinationPath || text("notSelected"))
      .addButton((button) => button
        .setButtonText(this.plugin.settings.destinationPath ? text("change") : text("chooseFolder"))
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

    containerEl.createEl("h3", { text: text("safety") });
    new Setting(containerEl)
      .setName(text("previewBeforeSync"))
      .setDesc(text("previewBeforeSyncDescription"))
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.previewBeforeSync)
        .onChange(async (value) => {
          this.plugin.settings.previewBeforeSync = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName(text("massDeletionWarning"))
      .setDesc(text("massDeletionWarningDescription"))
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.warnOnMassDeletion)
        .onChange(async (value) => {
          this.plugin.settings.warnOnMassDeletion = value;
          await this.plugin.saveSettings();
        }));

    containerEl.createEl("h3", { text: text("verification") });
    new Setting(containerEl)
      .setName(text("strictVerification"))
      .setDesc(text("strictVerificationDescription"))
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.strictVerification)
        .onChange(async (value) => {
          this.plugin.settings.strictVerification = value;
          await this.plugin.saveSettings();
        }));

    containerEl.createEl("h3", { text: text("advanced") });
    new Setting(containerEl)
      .setName(text("excludedFiles"))
      .setDesc(text("excludedFilesDescription"))
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

    containerEl.createEl("h3", { text: text("history") });
    if (this.plugin.settings.syncHistory.length === 0) {
      containerEl.createEl("p", { text: text("noHistory") });
      return;
    }

    for (const item of this.plugin.settings.syncHistory) {
      const entry = containerEl.createDiv({ cls: "vault-mirror-history" });
      entry.createEl("strong", {
        text: `${new Date(item.timestamp).toLocaleString(dateLocale(language))} · ${item.status === "success" ? text("success") : text("failed")}`
      });
      entry.createEl("span", {
        text: language === "zh-CN"
          ? `新增 ${item.created} · 更新 ${item.updated} · 删除 ${item.deleted} · 跳过 ${item.skipped} · ${(item.duration / 1000).toFixed(1)} 秒`
          : `${text("created")} ${item.created} · ${text("updated")} ${item.updated} · ${text("deleted")} ${item.deleted} · ${text("skipped")} ${item.skipped} · ${(item.duration / 1000).toFixed(1)} s`
      });
      if (item.errors[0]) entry.createEl("code", { text: item.errors[0].message });
    }
  }
}
