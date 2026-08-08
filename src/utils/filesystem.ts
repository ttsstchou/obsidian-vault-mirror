import path from "node:path";
import { readFile } from "node:fs/promises";

export const TEMP_DIRECTORY_PREFIX = ".vault-mirror-tmp-";
export const TEMP_MARKER_NAME = ".vault-mirror-owner";
export const TEMP_MARKER_CONTENT = "vault-mirror-owned-temp-v1\n";

const TEMP_DIRECTORY_PATTERN = /^\.vault-mirror-tmp-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function isOwnedTemporaryDirectory(
  parentPath: string,
  name: string
): Promise<boolean> {
  if (!TEMP_DIRECTORY_PATTERN.test(name)) return false;
  try {
    const marker = await readFile(path.join(parentPath, name, TEMP_MARKER_NAME), "utf8");
    return marker === TEMP_MARKER_CONTENT;
  } catch {
    return false;
  }
}
