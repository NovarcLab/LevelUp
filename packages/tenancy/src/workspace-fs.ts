import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { WorkspaceFs } from './context.js';

export function createWorkspaceFs(root: string): WorkspaceFs {
  const resolve = (rel: string): string => {
    const abs = path.resolve(root, rel);
    if (!abs.startsWith(root + path.sep) && abs !== root) {
      throw new Error(`path traversal blocked: ${rel}`);
    }
    return abs;
  };

  return {
    root,
    join(...segments: string[]): string {
      return resolve(path.join(...segments));
    },
    async readText(relPath: string): Promise<string> {
      return fs.readFile(resolve(relPath), 'utf8');
    },
    async readTextOrNull(relPath: string): Promise<string | null> {
      try {
        return await fs.readFile(resolve(relPath), 'utf8');
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw err;
      }
    },
    async writeTextAtomic(relPath: string, content: string): Promise<void> {
      const target = resolve(relPath);
      await fs.mkdir(path.dirname(target), { recursive: true });
      const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
      await fs.writeFile(tmp, content, 'utf8');
      await fs.rename(tmp, target);
    },
    async appendText(relPath: string, content: string): Promise<void> {
      const target = resolve(relPath);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.appendFile(target, content, 'utf8');
    },
    async remove(relPath: string): Promise<void> {
      await fs.rm(resolve(relPath), { force: true, recursive: true });
    },
    async exists(relPath: string): Promise<boolean> {
      try {
        await fs.access(resolve(relPath));
        return true;
      } catch {
        return false;
      }
    },
    async listDir(relPath: string): Promise<string[]> {
      try {
        return await fs.readdir(resolve(relPath));
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
        throw err;
      }
    },
    async mkdirp(relPath: string): Promise<void> {
      await fs.mkdir(resolve(relPath), { recursive: true });
    },
  };
}
