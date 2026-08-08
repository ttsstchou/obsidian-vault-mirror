import path from "node:path";
import os from "node:os";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  utimes,
  writeFile
} from "node:fs/promises";
import { afterEach, describe, expect, it } from "vitest";
import { Scanner } from "../src/sync/Scanner";
import { FileComparator } from "../src/sync/Comparator";
import { SyncPlanner } from "../src/sync/SyncPlanner";
import { SyncExecutor, SyncExecutionError } from "../src/sync/SyncExecutor";
import { SyncAlreadyInProgressError, SyncEngine } from "../src/sync/SyncEngine";
import { summarizeNoteChanges, summarizePlan } from "../src/sync/types";
import type { SyncPlan } from "../src/sync/types";
import { UnsafePathError, validateMirrorPaths } from "../src/utils/path";
import { isMassDeletion } from "../src/settings/safety";

const temporaryRoots: string[] = [];

afterEach(async () => {
  for (const root of temporaryRoots.splice(0)) {
    await rm(root, { recursive: true, force: true });
  }
});

describe("Vault Mirror", () => {
  it("creates, updates, deletes, mirrors nested/binary/.obsidian files, and removes directories", async () => {
    const { source, destination } = await makeVaultPair();
    await put(source, "test.md", "source version");
    await put(source, "Folder/Sub/note.md", "nested");
    await put(source, ".obsidian/hotkeys.json", "{\"x\":true}");
    await put(source, "Assets/image.bin", Buffer.from([0, 255, 20, 80]));
    await mkdir(path.join(source, "Empty"));

    await put(destination, "test.md", "old");
    await put(destination, "old.md", "remove me");
    await put(destination, "OldFolder/old.pdf", Buffer.from([1, 2, 3]));
    await put(destination, ".DS_Store", "excluded and preserved");

    const plan = await createPlan(source, destination);
    expect(summarizePlan(plan)).toMatchObject({ created: 3, updated: 1, deleted: 2 });

    const result = await new SyncExecutor().execute(plan, destination, false);
    expect(result.failed).toEqual([]);
    expect(await readFile(path.join(destination, "test.md"), "utf8")).toBe("source version");
    expect(await readFile(path.join(destination, "Folder/Sub/note.md"), "utf8")).toBe("nested");
    expect(await readFile(path.join(destination, "Assets/image.bin"))).toEqual(Buffer.from([0, 255, 20, 80]));
    expect(await readFile(path.join(destination, ".obsidian/hotkeys.json"), "utf8")).toBe("{\"x\":true}");
    expect((await stat(path.join(destination, "Empty"))).isDirectory()).toBe(true);
    await expect(stat(path.join(destination, "old.md"))).rejects.toThrow();
    await expect(stat(path.join(destination, "OldFolder"))).rejects.toThrow();
    expect(await readFile(path.join(destination, ".DS_Store"), "utf8")).toBe("excluded and preserved");
  });

  it("does no file work when both vaults are identical", async () => {
    const { source, destination } = await makeVaultPair();
    await put(source, "same.md", "same");
    await put(destination, "same.md", "same");

    const sourceTime = (await stat(path.join(source, "same.md"))).mtime;
    await utimes(path.join(destination, "same.md"), sourceTime, sourceTime);
    const plan = await createPlan(source, destination);
    expect(summarizePlan(plan)).toEqual({ created: 0, updated: 0, deleted: 0, skipped: 1 });
  });

  it("detects same-size content changes in strict verification mode", async () => {
    const { source, destination } = await makeVaultPair();
    await put(source, "same-size.md", "AAAA");
    await put(destination, "same-size.md", "BBBB");
    const fixed = new Date("2026-01-01T00:00:00Z");
    await utimes(path.join(source, "same-size.md"), fixed, fixed);
    await utimes(path.join(destination, "same-size.md"), fixed, fixed);

    const plan = await createPlan(source, destination, true);
    expect(summarizePlan(plan).updated).toBe(1);
  });

  it("replaces file/directory type conflicts safely", async () => {
    const { source, destination } = await makeVaultPair();
    await put(source, "to-file", "now a file");
    await put(destination, "to-file/old.md", "old child");
    await put(source, "to-dir/child.md", "new child");
    await put(destination, "to-dir", "was a file");

    const plan = await createPlan(source, destination);
    await new SyncExecutor().execute(plan, destination, false);

    expect(await readFile(path.join(destination, "to-file"), "utf8")).toBe("now a file");
    expect(await readFile(path.join(destination, "to-dir/child.md"), "utf8")).toBe("new child");
  });

  it("never enters the delete phase when a copy fails", async () => {
    const { source, destination } = await makeVaultPair();
    await put(source, "new.md", "new");
    await put(destination, "old.md", "must survive");
    const tempLikePath = ".vault-mirror-tmp-00000000-0000-0000-0000-000000000000/user.md";
    await put(destination, tempLikePath, "not owned by the plugin");
    const plan = await createPlan(source, destination);
    const executor = new SyncExecutor({
      copyFile: async () => {
        throw new Error("simulated disk error");
      }
    });

    let caught: unknown;
    try {
      await executor.execute(plan, destination, false);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(SyncExecutionError);
    expect(await readFile(path.join(destination, "old.md"), "utf8")).toBe("must survive");
    expect(await readFile(path.join(destination, tempLikePath), "utf8")).toBe("not owned by the plugin");
    await expect(stat(path.join(destination, "new.md"))).rejects.toThrow();
  });

  it("rejects equal and nested paths", async () => {
    const root = await makeTempRoot();
    const source = path.join(root, "source");
    const destination = path.join(source, "destination");
    await mkdir(destination, { recursive: true });

    await expect(validateMirrorPaths(source, source)).rejects.toBeInstanceOf(UnsafePathError);
    await expect(validateMirrorPaths(source, destination)).rejects.toBeInstanceOf(UnsafePathError);
    await expect(validateMirrorPaths(destination, source)).rejects.toBeInstanceOf(UnsafePathError);
  });

  it("prevents a second sync job while the first is awaiting confirmation", async () => {
    const { source, destination } = await makeVaultPair();
    const engine = new SyncEngine({ sourceStabilityDelayMs: 0 });
    let releaseConfirmation!: (confirmed: boolean) => void;
    let signalEntered!: () => void;
    const entered = new Promise<void>((resolve) => {
      signalEntered = resolve;
    });
    const first = engine.sync(source, destination, options(), {
      confirm: () => {
        signalEntered();
        return new Promise<boolean>((resolve) => {
          releaseConfirmation = resolve;
        });
      }
    });

    await entered;
    await expect(engine.sync(source, destination, options(), {
      confirm: async () => false
    })).rejects.toBeInstanceOf(SyncAlreadyInProgressError);
    releaseConfirmation(false);
    await expect(first).resolves.toMatchObject({ status: "cancelled" });
  });

  it("uses both configured mass-deletion thresholds", () => {
    expect(isMassDeletion(fakeDeletePlan(11, 1000))).toBe(true);
    expect(isMassDeletion(fakeDeletePlan(2, 10))).toBe(true);
    expect(isMassDeletion(fakeDeletePlan(1, 10))).toBe(false);
  });

  it("counts only Markdown notes outside .obsidian as note changes", () => {
    const plan: SyncPlan = {
      create: [operation("new-note.md"), operation("image.png")],
      update: [operation("Folder/edited.md"), operation(".obsidian/help.md")],
      delete: [operation("deleted.md"), operation("settings.json")],
      skip: [],
      destinationFileCount: 4
    };

    expect(summarizeNoteChanges(plan)).toEqual({
      created: 1,
      updated: 1,
      deleted: 1,
      total: 3
    });
  });

  it("rescans instead of failing when a source file disappears during staging", async () => {
    const { source, destination } = await makeVaultPair();
    await put(source, "note.md", "content");
    let copyAttempts = 0;
    let confirmations = 0;
    let sourceChangeNotifications = 0;
    const executor = new SyncExecutor({
      copyFile: async (from, to) => {
        copyAttempts += 1;
        if (copyAttempts === 1) {
          const error = new Error("temporarily missing") as NodeJS.ErrnoException;
          error.code = "ENOENT";
          throw error;
        }
        await copyFile(from, to);
      }
    });
    const engine = new SyncEngine({ executor, sourceStabilityDelayMs: 0 });

    const outcome = await engine.sync(source, destination, options(), {
      confirm: async () => {
        confirmations += 1;
        return true;
      },
      sourceChanged: () => {
        sourceChangeNotifications += 1;
      }
    });

    expect(outcome.status).toBe("completed");
    expect(confirmations).toBe(2);
    expect(sourceChangeNotifications).toBe(1);
    expect(await readFile(path.join(destination, "note.md"), "utf8")).toBe("content");
  });
});

async function makeTempRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "vault-mirror-test-"));
  temporaryRoots.push(root);
  return root;
}

async function makeVaultPair(): Promise<{ source: string; destination: string }> {
  const root = await makeTempRoot();
  const source = path.join(root, "source");
  const destination = path.join(root, "destination");
  await Promise.all([mkdir(source), mkdir(destination)]);
  return { source, destination };
}

async function put(root: string, relativePath: string, contents: string | Buffer): Promise<void> {
  const absolutePath = path.join(root, relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, contents);
}

async function createPlan(
  source: string,
  destination: string,
  strictVerification = false
): Promise<SyncPlan> {
  const scanner = new Scanner([".DS_Store"]);
  const [sourceEntries, destinationEntries] = await Promise.all([
    scanner.scan(source),
    scanner.scan(destination)
  ]);
  return new SyncPlanner(new FileComparator(strictVerification)).createPlan(
    sourceEntries,
    destinationEntries
  );
}

function options() {
  return { excludedPaths: [".DS_Store"], strictVerification: false };
}

function fakeDeletePlan(deleteCount: number, destinationFileCount: number): SyncPlan {
  return {
    create: [],
    update: [],
    skip: [],
    destinationFileCount,
    delete: Array.from({ length: deleteCount }, (_, index) => ({
      relativePath: `${index}.md`,
      type: "file" as const
    }))
  };
}

function operation(relativePath: string) {
  return { relativePath, type: "file" as const };
}
