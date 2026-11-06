import pg from 'pg';
if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL in .env.local');
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 5000,
});
try {
  await client.connect();
  const result = await client.query(`SELECT current_database() AS database,
    (SELECT count(*)::int FROM users WHERE status = 'ACTIVE') AS active_users,
    (SELECT count(*)::int FROM complaints) AS complaints,
    (SELECT pg_get_constraintdef(oid) FROM pg_constraint
      WHERE conrelid = 'complaint_assignments'::regclass AND conname = 'chk_assign_status') AS assignment_constraint`);
  if (!result.rows[0].assignment_constraint?.includes('ON_HOLD'))
    throw new Error('Apply database/05_app_compatibility.sql');
  console.log('PostgreSQL connection and application schema OK:', {
    database: result.rows[0].database,
    active_users: result.rows[0].active_users,
    complaints: result.rows[0].complaints,
  });
} catch (error) {
  console.error('Database check failed:', error.code ?? error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
