import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import type { FileEntry } from "./types";

export class FileComparator {
  constructor(private readonly strictVerification: boolean) {}

  async areEqual(source: FileEntry, destination: FileEntry): Promise<boolean> {
    if (source.type !== "file" || destination.type !== "file") {
      return source.type === destination.type;
    }

    if (source.size !== destination.size) {
      return false;
    }

    if (!this.strictVerification && source.modifiedTime === destination.modifiedTime) {
      return true;
    }

    const [sourceHash, destinationHash] = await Promise.all([
      hashFile(source.absolutePath),
      hashFile(destination.absolutePath)
    ]);
    return sourceHash === destinationHash;
  }
}

export async function hashFile(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  const stream = createReadStream(filePath);
  for await (const chunk of stream) {
    hash.update(chunk as Buffer);
  }
  return hash.digest("hex");
}
