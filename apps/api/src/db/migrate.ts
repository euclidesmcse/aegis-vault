// Migrator simplificado: le migrations/*.sql em ordem lexica.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MIGRATIONS_DIR = path.resolve(__dirname, '../../../db/migrations');

async function ensureMigrationsTable(sql: postgres.Sql) {
  await sql`CREATE TABLE IF NOT EXISTS schema_migrations (
    id TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
}

export async function runUp(sql: postgres.Sql) {
  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
  await ensureMigrationsTable(sql);
  for (const f of files) {
    const id = f;
    const exists = await sql<{ id: string }[]>`SELECT id FROM schema_migrations WHERE id = ${id}`;
    if (exists.length > 0) {
      console.log(`SKIP ${id}`);
      continue;
    }
    const content = fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf-8');
    console.log(`APPLY ${id}`);
    await sql.begin(async (tx) => {
      await tx.unsafe(content);
      await tx`INSERT INTO schema_migrations (id) VALUES (${id})`;
    });
  }
}

export async function runDown(sql: postgres.Sql) {
  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort().reverse();
  for (const f of files) {
    const content = fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf-8');
    await sql.begin(async (tx) => {
      await tx.unsafe('-- ROLLBACK ' + f + '\n' +
        content
          .split('\n')
          .filter((line) => !/^CREATE\s+EXTENSION/i.test(line))
          .map((line) => (/^CREATE\s+TABLE/i.test(line) ? line.replace(/^CREATE\s+TABLE/i, 'DROP TABLE IF EXISTS') : line.replace(/^CREATE\s+INDEX/i, 'DROP INDEX IF EXISTS')))
          .join('\n'),
      );
      await tx`DELETE FROM schema_migrations WHERE id = ${f}`;
    });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = process.argv[2] ?? '--up';
  const url = process.env['DATABASE_URL'];
  if (!url) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }
  const sql = postgres(url, { max: 1 });
  if (arg === '--up') await runUp(sql);
  else if (arg === '--down') await runDown(sql);
  await sql.end();
}
