import { app } from "electron";
import fs from "node:fs";
import path from "node:path";

export type SessionV1 = {
  version: 1;
  rootPath: string;
  activePath: string | null;
  updatedAt: number;
};

const SESSION_FILE = () => path.join(app.getPath("userData"), "session.json");

export async function readSession(): Promise<SessionV1 | null> {
  try {
    const raw = await fs.promises.readFile(SESSION_FILE(), "utf-8");
    const data = JSON.parse(raw) as SessionV1;
    if (data.version !== 1 || typeof data.rootPath !== "string") return null;
    return data;
  } catch {
    return null;
  }
}

export async function writeSession(partial: {
  rootPath: string;
  activePath?: string | null;
}): Promise<void> {
  const prev = await readSession();
  const next: SessionV1 = {
    version: 1,
    rootPath: partial.rootPath,
    activePath:
      partial.activePath !== undefined
        ? partial.activePath
        : prev?.rootPath === partial.rootPath
          ? prev.activePath
          : null,
    updatedAt: Date.now(),
  };
  await fs.promises.mkdir(path.dirname(SESSION_FILE()), { recursive: true });
  const tmp = `${SESSION_FILE()}.tmp`;
  await fs.promises.writeFile(tmp, JSON.stringify(next, null, 2), "utf-8");
  await fs.promises.rename(tmp, SESSION_FILE());
}

export async function clearSession(): Promise<void> {
  try {
    await fs.promises.unlink(SESSION_FILE());
  } catch {
    /* missing file is fine */
  }
}
