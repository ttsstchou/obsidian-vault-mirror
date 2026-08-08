interface OpenDialogResult {
  canceled: boolean;
  filePaths: string[];
}

interface ElectronDialog {
  showOpenDialog(options: {
    title: string;
    properties: Array<"openDirectory" | "createDirectory">;
  }): Promise<OpenDialogResult>;
}

interface ElectronModule {
  dialog?: ElectronDialog;
  remote?: { dialog?: ElectronDialog };
}

export async function chooseDestinationFolder(): Promise<string | undefined> {
  const electron = require("electron") as ElectronModule;
  let dialog = electron.remote?.dialog ?? electron.dialog;
  if (!dialog) {
    try {
      const remote = require("@electron/remote") as { dialog?: ElectronDialog };
      dialog = remote.dialog;
    } catch {
      // Older Obsidian versions expose the dialog through electron.remote.
    }
  }
  if (!dialog) {
    throw new Error("当前 Obsidian 版本无法使用 macOS 文件夹选择器。");
  }

  const result = await dialog.showOpenDialog({
    title: "选择 iCloud Obsidian Vault",
    properties: ["openDirectory"]
  });
  return result.canceled ? undefined : result.filePaths[0];
}
