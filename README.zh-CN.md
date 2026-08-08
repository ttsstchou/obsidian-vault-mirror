# Vault Mirror

[English](./README.md) · [安全说明](./docs/SAFETY.md) · [隐私说明](./docs/PRIVACY.md)

![Vault Mirror 安全地将 Obsidian Vault 镜像到本地云同步文件夹。](./assets/vault-mirror-hero.png)

**Vault Mirror** 是一个 macOS Obsidian 桌面端插件，用于建立清晰的多设备工作流：在 Mac 主 Vault 写作，通过 iCloud Drive 镜像到 iPhone Vault，在手机端查看和阅读。

```text
✍️ Mac 主 Vault（唯一可信源）→ ☁️ iCloud Drive 目标 Vault → 📱 iPhone（查看与阅读）
```

它只在 Mac 本地文件系统运行，不连接百度网盘、iCloud 或任何云端 API。百度网盘和 iCloud Drive 客户端仍然各自负责云端传输。

> [!danger]
> **首次同步前请先备份。** 请复制或归档源 Vault，以及已有的 iCloud 目标 Vault。Vault Mirror 是单向镜像工具，不是备份工具，也不是双向同步；仅存在于目标端的文件或修改，可能在下次同步时被覆盖或删除。

> [!important]
> **手机端只负责查看。** 请在 Mac 主 Vault 中创建和编辑笔记，完成后再执行镜像；iPhone 上的 iCloud Vault 建议只用于查看和阅读。手机端的修改可能在下次同步时丢失。

## 🧭 多设备工作流

主 Vault 位于一个桌面同步盘，但 iPhone 只能使用 iCloud Drive 中的 Vault 时，可以在 Mac 上建立这条单向桥梁：

1. ✍️ 在 Mac 的 Obsidian 中打开并编辑**主 Vault**。
2. ☁️ 在设置中选择一次准确的 **iCloud 目标 Vault**。
3. 🔍 每次主动同步前查看**实时扫描**结果。
4. ✅ 确认后执行安全的单向镜像。
5. 📱 等待 iCloud Drive 完成后，在 iPhone 上查看和阅读最新内容。

默认会同步 Markdown、附件、隐藏文件和 `.obsidian` 配置；只有在所有新增与更新成功后，才会删除目标端多余的文件。

## ✨ 主要功能

- 🧠 自动以当前打开的 Vault 作为源 Vault。
- ☁️ 目标 Vault 只需选择一次，路径会保存。
- 🔍 每次点击同步都会重新实时扫描，不复用上次计划。
- 📝 顶部突出显示 Markdown 笔记变更数量，并保留全部文件变更数量。
- 🛡️ 先暂存复制和更新，再执行删除；复制或校验失败时不删除目标文件。
- 🔄 更新时使用临时暂存和回滚保护。
- ⏳ 百度网盘等客户端仍在创建或删除临时文件时，先等待源 Vault 稳定。
- ⚠️ 大量删除警告、危险路径拦截、防并发和最近 20 次同步历史。
- 🔒 无账号、无遥测、无网络传输。

## 同步预览

预览始终是刚刚完成的实时扫描结果。它会显示源路径、目标路径、笔记变更数量、完整文件变更数量和删除警告。

![中文同步预览示意图，显示笔记变更数量与全部文件变更明细。](./assets/sync-preview-zh.svg)

同步过程中会显示扫描、比较、复制、更新、校验和删除阶段；文件数量已知时会显示百分比与当前路径。

## 安装

可在 **设置 → 第三方插件** 中搜索并启用 **Vault Mirror**。

手动安装：

1. 从匹配版本的 GitHub Release 下载 `main.js`、`manifest.json`、`styles.css`。
2. 在运行插件的 Vault 中创建：

   ```text
   <你的 Vault>/.obsidian/plugins/vault-mirror/
   ```

3. 将三个文件复制到该目录。
4. 重载 Obsidian，并在 **设置 → 第三方插件** 中启用 Vault Mirror。

## 🚀 首次设置与日常使用

1. 🧳 **首次使用前备份两边 Vault**。
2. ✍️ 在 macOS Obsidian 中打开源 Vault；它是唯一可信数据源。
3. ⚙️ 打开 **设置 → 第三方插件 → Vault Mirror**。
4. 📁 在“目标文件夹”中选择具体的 iCloud Vault 文件夹，不要只选择上一级 `Documents` 文件夹。
5. ☁️ 点击左侧 Ribbon 的云端上传图标，或在命令面板运行 **Vault Mirror: Sync to iCloud**。
6. 🔍 等待实时扫描完成，检查笔记变更、全部文件变更、源路径、目标路径和删除数量。
7. ✅ 点击“开始同步”。
8. 📱 等待 iCloud Drive 完成后，在手机端查看与阅读最新内容。

## 安全边界

插件会拒绝以下情况：源和目标相同、任一路径位于另一方内部、目标不存在、目标不可写、并发同步、符号链接、源 Vault 持续变化。

默认只排除 `.DS_Store`。`.obsidian` 默认同步；可在“高级 → 排除的文件”中添加准确的文件或文件夹规则。

详情请阅读[安全说明](./docs/SAFETY.md)。

## 限制

- 仅支持 macOS 桌面端。
- 仅支持单向同步，不解决冲突。
- V1 不包含后台监听、定时同步、云端 API 或网络传输。
- iPhone 在目标 Vault 中产生的修改和设备配置，可能在下一次预览中显示为待变更项目；源 Vault 始终是唯一可信数据源。

## 开发与发布

```bash
pnpm install
pnpm test
pnpm build
```

发布时，GitHub Release 的标签必须与 `manifest.json` 中的版本完全一致，并附上 `main.js`、`manifest.json` 与 `styles.css`。详见[发布说明](./docs/RELEASE.md)。

## 许可

[MIT](./LICENSE)
