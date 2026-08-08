export type Language = "zh-CN" | "en";

const messages = {
  "zh-CN": {
    language: "界面语言",
    languageDescription: "选择 Vault Mirror 的显示语言。切换后会立即更新设置页。",
    chinese: "简体中文",
    english: "English",
    syncToICloud: "同步到 iCloud",
    syncCommand: "同步到 iCloud",
    sourceVault: "源 Vault",
    currentVault: "当前 Vault",
    destinationVault: "目标 Vault",
    destinationFolder: "目标文件夹",
    notSelected: "尚未选择目标文件夹",
    change: "更改",
    chooseFolder: "选择文件夹",
    safety: "安全",
    previewBeforeSync: "同步前预览",
    previewBeforeSyncDescription: "执行同步前显示文件变更摘要。",
    massDeletionWarning: "大量删除警告",
    massDeletionWarningDescription: "删除超过 10 个文件或目标文件总数的 10% 时显示醒目警告。",
    verification: "校验",
    strictVerification: "严格文件校验",
    strictVerificationDescription: "使用 SHA-256 比较并校验暂存副本。大型 Vault 的同步速度会变慢。",
    advanced: "高级",
    excludedFiles: "排除的文件",
    excludedFilesDescription: "每行填写一个相对路径，或准确的文件/文件夹名称。默认不会排除 .obsidian。",
    history: "同步历史",
    noHistory: "暂无同步记录。",
    success: "成功",
    failed: "失败",
    created: "新增",
    updated: "更新",
    deleted: "删除",
    skipped: "跳过",
    close: "关闭",
    cancel: "取消",
    startSync: "开始同步"
  },
  en: {
    language: "Interface language",
    languageDescription: "Choose the display language for Vault Mirror. The settings page updates immediately.",
    chinese: "Simplified Chinese",
    english: "English",
    syncToICloud: "Sync to iCloud",
    syncCommand: "Sync to iCloud",
    sourceVault: "Source vault",
    currentVault: "Current vault",
    destinationVault: "Destination vault",
    destinationFolder: "Destination folder",
    notSelected: "No destination folder selected",
    change: "Change",
    chooseFolder: "Choose folder",
    safety: "Safety",
    previewBeforeSync: "Preview before syncing",
    previewBeforeSyncDescription: "Show a summary of file changes before applying a sync.",
    massDeletionWarning: "Large deletion warning",
    massDeletionWarningDescription: "Show a prominent warning when more than 10 files or 10% of destination files will be deleted.",
    verification: "Verification",
    strictVerification: "Strict file verification",
    strictVerificationDescription: "Use SHA-256 to compare files and verify staged copies. This can slow down large vaults.",
    advanced: "Advanced",
    excludedFiles: "Excluded files",
    excludedFilesDescription: "One relative path or exact file/folder name per line. .obsidian is included by default.",
    history: "Sync history",
    noHistory: "No sync history yet.",
    success: "Succeeded",
    failed: "Failed",
    created: "Created",
    updated: "Updated",
    deleted: "Deleted",
    skipped: "Skipped",
    close: "Close",
    cancel: "Cancel",
    startSync: "Start sync"
  }
} as const;

export function t(language: Language, key: keyof typeof messages["zh-CN"]): string {
  return messages[language][key];
}

export function dateLocale(language: Language): string {
  return language === "en" ? "en-US" : "zh-CN";
}
