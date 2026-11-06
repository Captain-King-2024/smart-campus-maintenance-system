# Verification record

Verified on 6 November 2026 with Node.js 24.22.1, npm 11.9.0, and a real disposable PostgreSQL 18.6 server.

| Check                             | Result                                                        |
| --------------------------------- | ------------------------------------------------------------- |
| TypeScript                        | Passed                                                        |
| Mock service tests                | 12 passed                                                     |
| Real PostgreSQL integration suite | 6 subtests plus parent passed; 0 failures                     |
| Production build                  | Passed; pages and API handlers compiled                       |
| PostgreSQL HTTP smoke             | 62 checks passed across all five roles                        |
| Runtime database permissions      | HTTP checks used a non-superuser login inheriting `app_admin` |
| Original SQL preservation         | Four supplied files retained unchanged                        |

The PostgreSQL integration suite installs the real schema and seed, then applies the compatibility migration twice. It checks all 14 repository reads, seed roles, date and numeric conversion, parameterized strings, complaint ownership, technician ownership, full repair workflow including hold/resume, exact audit sequence and actors, one stock deduction, generated totals, rollback of multiple writes, concurrent final-unit stock requests, duplicate feedback, active/held reassignment, admin CRUD, and transaction-local actor isolation.

The HTTP smoke checks cover server-rendered routes, all role sessions, unauthenticated and wrong-role access, invalid input, origin validation, submit/review/assign/accept/start/hold/resume/log/material/complete/feedback, inventory reads, and admin department CRUD. The SQL fixture tests use an owner connection; the live API checks use the separate non-superuser app login.

## Repeat locally

- `npm run typecheck`
- `npm test`
- `npm run build`
- Start the development server after [database setup](../database/README.md), then set `DATA_PROVIDER=postgres` in the smoke-test terminal and run `npm run test:http`. This creates demo records in that database.
- For integration tests, set `TEST_DATABASE_URL` to a disposable owner database ending in `_test` and `CAMPUS_TEST_RESET=true`, then run `npm run test:postgres`. The test resets the project tables. Do not use your working database.

## Limits

No user-hosted database credentials or live deployment were supplied. Validation used a temporary local PostgreSQL instance, not the user's eventual database. Browser visual QA was not performed for the app; HTTP rendering and API behavior were checked. Demo role selection and process-local sessions remain intentionally unchanged as authentication features; production authentication and hosting are not part of this integration. The global mutation lock and collection-based reads prioritize classroom correctness over large-scale throughput.
