import path from "node:path";
import { realpath, stat } from "node:fs/promises";

export class UnsafePathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafePathError";
  }
}

function isInside(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return relative !== "" && !relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative);
}

export async function validateMirrorPaths(source: string, destination: string): Promise<{
  source: string;
  destination: string;
}> {
  let resolvedSource: string;
  let resolvedDestination: string;

  try {
    [resolvedSource, resolvedDestination] = await Promise.all([
      realpath(source),
      realpath(destination)
    ]);
  } catch (error) {
    throw new UnsafePathError(`源文件夹和目标文件夹都必须存在：${errorMessage(error)}`);
  }

  const [sourceStat, destinationStat] = await Promise.all([
    stat(resolvedSource),
    stat(resolvedDestination)
  ]);

  if (!sourceStat.isDirectory() || !destinationStat.isDirectory()) {
    throw new UnsafePathError("源路径和目标路径都必须是文件夹。");
  }

  if (resolvedSource === resolvedDestination) {
    throw new UnsafePathError("源 Vault 和目标文件夹不能是同一个文件夹。");
  }

  if (path.parse(resolvedDestination).root === resolvedDestination) {
    throw new UnsafePathError("不能将文件系统根目录设为目标文件夹。");
  }

  if (isInside(resolvedSource, resolvedDestination)) {
    throw new UnsafePathError("目标文件夹不能位于源 Vault 内部。");
  }

  if (isInside(resolvedDestination, resolvedSource)) {
    throw new UnsafePathError("源 Vault 不能位于目标文件夹内部。");
  }

  return { source: resolvedSource, destination: resolvedDestination };
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
