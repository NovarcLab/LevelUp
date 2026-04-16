import Database from 'better-sqlite3';
import { join } from 'node:path';
import type { VectorStore } from '@levelup/tenancy';

/**
 * SQLite-backed vector store using plain cosine similarity.
 *
 * Stores embeddings as JSON Float32Array in a regular SQLite table.
 * For production scale, this can be swapped to sqlite-vec when the
 * native extension is available, or to pgvector via the same interface.
 *
 * Current approach: brute-force cosine similarity — sufficient for
 * the per-tenant scale (hundreds to low thousands of vectors).
 */
export function createSqliteVectorStore(tenantDir: string): VectorStore {
  const dbPath = join(tenantDir, 'vectors', 'memory.sqlite');
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');

  db.exec(`
    CREATE TABLE IF NOT EXISTS vectors (
      id TEXT PRIMARY KEY,
      embedding TEXT NOT NULL,
      dims INTEGER NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );
  `);

  const insertStmt = db.prepare(
    'INSERT OR REPLACE INTO vectors (id, embedding, dims) VALUES (?, ?, ?)',
  );
  const deleteStmt = db.prepare('DELETE FROM vectors WHERE id = ?');
  const allStmt = db.prepare('SELECT id, embedding FROM vectors');

  function cosine(a: Float32Array, b: Float32Array): number {
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i]! * b[i]!;
      normA += a[i]! * a[i]!;
      normB += b[i]! * b[i]!;
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
  }

  return {
    upsert(id: string, embedding: Float32Array): void {
      const json = JSON.stringify(Array.from(embedding));
      insertStmt.run(id, json, embedding.length);
    },

    query(embedding: Float32Array, k: number): { id: string; distance: number }[] {
      const rows = allStmt.all() as { id: string; embedding: string }[];
      const scored = rows.map((row) => {
        const stored = new Float32Array(JSON.parse(row.embedding) as number[]);
        const sim = cosine(embedding, stored);
        return { id: row.id, distance: 1 - sim }; // cosine distance
      });
      scored.sort((a, b) => a.distance - b.distance);
      return scored.slice(0, k);
    },

    remove(id: string): void {
      deleteStmt.run(id);
    },

    close(): void {
      try { db.close(); } catch { /* already closed */ }
    },
  };
}
