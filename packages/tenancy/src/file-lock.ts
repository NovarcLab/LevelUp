import { writeFileSync, unlinkSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * Simple file-based lock using exclusive file creation.
 * Worker and API share the same data/locks/ directory to coordinate access.
 *
 * The lock file contains the PID and timestamp of the holder.
 * Stale locks (older than staleMs) are automatically broken.
 */
export interface FileLock {
  release(): void;
}

const STALE_MS = 60_000; // 1 minute

export function acquireLock(lockDir: string, name: string): FileLock | null {
  const lockPath = join(lockDir, `${name}.lock`);
  mkdirSync(dirname(lockPath), { recursive: true });

  // Check for stale lock
  if (existsSync(lockPath)) {
    try {
      const content = readFileSync(lockPath, 'utf-8');
      const ts = parseInt(content.split('\n')[1] ?? '0', 10);
      if (Date.now() - ts > STALE_MS) {
        unlinkSync(lockPath);
      } else {
        return null; // lock is held
      }
    } catch {
      // corrupted lock file — remove and retry
      try { unlinkSync(lockPath); } catch { /* ignore */ }
    }
  }

  try {
    writeFileSync(lockPath, `${process.pid}\n${Date.now()}`, { flag: 'wx' });
  } catch {
    return null; // another process grabbed it
  }

  return {
    release() {
      try { unlinkSync(lockPath); } catch { /* already released */ }
    },
  };
}

/**
 * Run a function while holding a lock. Returns null if the lock couldn't be acquired.
 */
export async function withLock<T>(
  lockDir: string,
  name: string,
  fn: () => T | Promise<T>,
): Promise<T | null> {
  const lock = acquireLock(lockDir, name);
  if (!lock) return null;
  try {
    return await fn();
  } finally {
    lock.release();
  }
}
