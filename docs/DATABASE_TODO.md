# Database integration status

The PostgreSQL integration is implemented. See [database setup](../database/README.md) for initialization, configuration, SQL run order, credentials and test commands.

Completed: all 14 repositories, provider selection, connection pooling, parameterized CRUD, per-request transactions, actor attribution, trigger-owned history and stock deduction, hold/resume compatibility, generated totals, correct numeric/date types, seed-aware login cards, database error mapping, rollback and concurrency tests.

Remaining work before production deployment:

- Replace public demo role selection with real credential verification, password hashing or campus SSO, rate limits and durable sessions.
- Configure hosting, verified TLS, backups and database monitoring.
- Add pagination and filtered SQL queries for larger datasets; the existing service contracts currently load collections for filtering and metrics.
- For high write throughput, replace the single advisory transaction lock with carefully ordered per-record locks and repeat the concurrency tests. External SQL writers do not automatically share the application's advisory lock.
- Add technician profile provisioning if users are created with the TECHNICIAN role; creating a user alone does not create a technician profile.

The supplied SQL roles are group grants, not row-level policies. The application uses one private server-side database login and enforces end-user roles in its services. Do not distribute its credentials to end users.
