import { AsyncLocalStorage } from 'node:async_hooks';
import { Pool, types, type PoolClient } from 'pg';
import { AppError } from './errors';

// The supplied schema uses timestamp WITHOUT time zone. Treat it as UTC consistently.
types.setTypeParser(1114, (value) => new Date(value.replace(' ', 'T') + 'Z').toISOString());
types.setTypeParser(1082, (value) => value);
types.setTypeParser(1700, Number);
const state = globalThis as unknown as {
  campusPool?: Pool;
  campusTransaction?: AsyncLocalStorage<PoolClient>;
};
const context = (state.campusTransaction ??= new AsyncLocalStorage<PoolClient>());
export function pool() {
  if (!process.env.DATABASE_URL) throw new AppError(503, 'DATABASE_URL is required for PostgreSQL');
  if (!state.campusPool) {
    state.campusPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      options: '-c timezone=UTC -c search_path=public -c statement_timeout=15000',
    });
    state.campusPool.on('error', () => console.error('Idle PostgreSQL connection failed'));
  }
  return state.campusPool;
}
export function connection() {
  return context.getStore() ?? pool();
}
export function inTransaction() {
  return !!context.getStore();
}
export async function transaction<T>(actorId: number, operation: () => Promise<T>): Promise<T> {
  if (context.getStore()) return operation();
  const client = await pool().connect();
  let discard = false;
  try {
    await client.query('BEGIN');
    // Small campus workload: serialize application writes across ALL server processes.
    // The lock is transaction-scoped and automatically released on commit/rollback.
    await client.query('SELECT pg_advisory_xact_lock(72419, 1)');
    await client.query("SELECT set_config('app.current_user_id', $1, true)", [String(actorId)]);
    const result = await context.run(client, operation);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      discard = true;
    }
    throw error;
  } finally {
    client.release(discard);
  }
}
export function databaseError(error: unknown): AppError | null {
  const code = (error as { code?: string })?.code;
  if (code === '23505')
    return new AppError(409, 'A record with these unique details already exists');
  if (code === '23503') return new AppError(409, 'A referenced record is missing or still in use');
  if (['23514', '23502', '22001', '22P02', '22003', '22007'].includes(code ?? ''))
    return new AppError(400, 'The supplied values do not meet the database constraints');
  if (code === 'P0001')
    return new AppError(
      409,
      'The database rejected this workflow change. Refresh and check the current status or stock.',
    );
  if (['40001', '40P01', '55P03', '57014'].includes(code ?? ''))
    return new AppError(409, 'The data is busy; refresh and retry');
  if (['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', '28P01', '3D000', '42P01'].includes(code ?? ''))
    return new AppError(503, 'Database unavailable or not initialized. Check the server setup.');
  return null;
}
