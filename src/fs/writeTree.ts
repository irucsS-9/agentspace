import {
  cp,
  mkdir,
  mkdtemp,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, join } from "node:path";
import type { GeneratedFile } from "../types";

export interface WriteOptions {
  force: boolean;
}

async function isNonEmptyDir(dir: string): Promise<boolean> {
  try {
    const entries = await readdir(dir);
    return entries.length > 0;
  } catch {
    return false; // does not exist → treated as empty
  }
}

/**
 * Writes all files first into a sibling temp dir (same filesystem, so the final
 * move is atomic), then promotes it into place. If anything throws during the
 * write phase, the temp dir is removed and the target is left untouched.
 */
export async function writeTree(
  files: GeneratedFile[],
  targetDir: string,
  opts: WriteOptions,
): Promise<void> {
  if (!opts.force && (await isNonEmptyDir(targetDir))) {
    throw new Error(
      `Target directory is not empty: ${targetDir}. Re-run with --force to write anyway.`,
    );
  }

  const parent = dirname(targetDir);
  await mkdir(parent, { recursive: true });
  const temp = await mkdtemp(join(parent, ".agentspace-tmp-"));

  try {
    for (const file of files) {
      const dest = join(temp, file.path);
      await mkdir(dirname(dest), { recursive: true });
      await writeFile(dest, file.contents);
    }

    if (opts.force) {
      // Merge into existing dir, preserving unrelated files.
      // cp is not atomic; a partial write is possible here (acceptable for an opt-in --force override).
      await cp(temp, targetDir, { recursive: true, force: true });
      await rm(temp, { recursive: true, force: true });
    } else if (await isNonEmptyDir(targetDir)) {
      // Defensive: an empty target dir may have appeared (e.g. cwd); merge rather than throw.
      // Empty dir may exist (e.g. cwd). Merge then drop temp.
      await cp(temp, targetDir, { recursive: true, force: true });
      await rm(temp, { recursive: true, force: true });
    } else {
      await rm(targetDir, { recursive: true, force: true }).catch(() => {});
      await rename(temp, targetDir);
    }
  } catch (err) {
    await rm(temp, { recursive: true, force: true }).catch(() => {});
    throw err;
  }
}
