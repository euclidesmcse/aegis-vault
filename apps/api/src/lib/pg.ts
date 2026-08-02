import postgres from 'postgres';
export function createPgPool(url: string): postgres.Sql {
  return postgres(url, {
    max: Number(process.env['DATABASE_POOL_MAX'] ?? 20),
    idle_timeout: 20,
    connect_timeout: 10,
    statement_timeout: 15_000,
  });
}
