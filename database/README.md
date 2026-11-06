# PostgreSQL setup

The four numbered SQL files from the supplied ZIP are preserved unchanged. `05_app_compatibility.sql` adds support for the application's held assignments and counts held work in technician workload. It also grants identity-sequence access to the existing `app_admin` role. It is repeatable and does not reset records.

| File                       | Purpose                                                                              | Run automatically?                 |
| -------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------- |
| `01_schema.sql`            | 14 tables, constraints, indexes, triggers, functions, procedures, views, group roles | Run once for a new database        |
| `02_seed_data.sql`         | Classroom sample data                                                                | Optional fresh-database demo setup |
| `03_queries_and_demo.sql`  | SQL concepts, demonstrations and transactions                                        | Run selected blocks manually       |
| `04_backend_queries.sql`   | Parameterized query reference                                                        | Do not execute as one script       |
| `05_app_compatibility.sql` | Application workflow compatibility migration                                         | Run after schema/seed              |

**Use a dedicated database.** The supplied schema drops existing project tables; the seed truncates them. Re-running either erases project data. Neither script runs on app startup. The demo query file also changes data and includes deliberate error examples.

## 1. Create and initialize the database

Install PostgreSQL and its `psql` client. From the repository root, using a database owner with permission to create the supplied group roles:

```sh
psql -U postgres -c "CREATE DATABASE smart_campus_db;"
psql -U postgres -d smart_campus_db -v ON_ERROR_STOP=1 -f database/01_schema.sql
psql -U postgres -d smart_campus_db -v ON_ERROR_STOP=1 -f database/02_seed_data.sql
psql -U postgres -d smart_campus_db -v ON_ERROR_STOP=1 -f database/05_app_compatibility.sql
```

In pgAdmin, create the database, connect its Query Tool, and execute those three files in that order. Skip the seed only if you will populate your own reference data and active users. The login chooser reads users from the database and does not assume the mock IDs.

For an already initialized database, apply only `05_app_compatibility.sql`. If you have independently changed the schema, review the migration against those changes first.

## 2. Create the application login

In an administrator `psql` session connected to `smart_campus_db`:

```sql
CREATE ROLE campus_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE;
GRANT CONNECT ON DATABASE smart_campus_db TO campus_app;
GRANT USAGE ON SCHEMA public TO campus_app;
GRANT app_admin TO campus_app;
```

Set its password interactively with `\password campus_app`. The server uses one application login; API services enforce the selected user's role and ownership. The database group roles supplied in file 01 are not row-level security and are not a replacement for API authorization. Keep this login and database connection private to the backend.

## 3. Configure and start Next.js

Run `npm ci`. Copy `.env.example` to `.env.local` and edit:

```dotenv
DATA_PROVIDER=postgres
DATABASE_URL=postgresql://campus_app:YOUR_PASSWORD@localhost:5432/smart_campus_db
```

URL-encode reserved characters in passwords. For hosted PostgreSQL, use the provider's TLS-verified connection string; do not disable certificate verification. `DATABASE_URL` is server-only. `.env.local` is excluded from Git.

```sh
npm run db:check
npm run dev
```

Open http://localhost:3000/login. Select a role. The supplied seed's first active users are:

| Role                | ID  | Name             |
| ------------------- | --- | ---------------- |
| Student             | 12  | Aarav Sharma     |
| Faculty             | 16  | Dr. Kavita Joshi |
| Technician          | 4   | Ravi Shankar     |
| Maintenance Manager | 2   | Suresh Kumar     |
| Admin               | 1   | Meera Nair       |

New complaints, assignments, logs, stock changes and feedback persist across server restarts. Sessions still use the original single-process demo authentication: sign in again after restarting. This is an academic app, not a production login system.

## Transaction and trigger behavior

- Each non-auth API mutation checks the session and runs in one transaction on one checked-out `pg` client. All repositories share it through `AsyncLocalStorage`. The session/account is checked again inside the transaction.
- A database advisory transaction lock serializes application mutations across processes. This deliberately favors correctness for a small classroom workload over high write throughput. Inventory also uses the supplied trigger's row lock. External SQL writers must coordinate independently.
- `app.current_user_id` is set locally in the transaction for audit attribution and cannot leak to the next pooled request.
- Complaint history and stock deduction are owned by the SQL triggers. The services skip their mock equivalents. Generated material totals are never inserted or updated by the application.
- Assignment start/completion are synchronized by triggers; the compatibility migration supports hold/resume. Reassignment cancels previous active work in the same transaction. Active work passes through `ON_HOLD` before the replacement assignment moves the complaint to `ASSIGNED`.
- Numeric costs/hours are returned as JSON numbers; timestamp-without-time-zone fields are interpreted as UTC ISO strings; `work_date` stays `YYYY-MM-DD`.
- SQL values use bound parameters. Table and column identifiers come from an explicit code allowlist. Constraint conflicts return controlled HTTP errors.

The SQL procedures remain available for manual DBMS demonstrations. The app uses repository writes that activate the same supplied triggers; it does not blindly execute the reference query file.

## Verification

`npm test` covers mock service behavior. `npm run typecheck` and `npm run build` validate the app. With the PostgreSQL development server running, `DATA_PROVIDER=postgres npm run test:http` exercises all five roles against the seeded IDs (PowerShell: set `$env:DATA_PROVIDER='postgres'` first).

For real-database integration tests, create a separate disposable database whose name ends in `_test`. Set `TEST_DATABASE_URL` to its owner connection and `CAMPUS_TEST_RESET=true`, then run `npm run test:postgres`. This explicitly resets that test database's project tables; never point it at your working database. Without both variables the integration suite skips. It checks the real SQL, rollback, concurrent stock and feedback requests, reassignment, ownership, types, and exactly-once history/stock effects.
