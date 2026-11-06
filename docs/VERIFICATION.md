# Verification record

Verified on 31 October 2026 with Node.js 24.22.1 and npm 11.9.0.

| Check                                                            | Result                                                                                                               |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Dependency installation with the committed lockfile dependencies | Passed                                                                                                               |
| `npm run typecheck`                                              | Passed                                                                                                               |
| `npm test`                                                       | 12 passed, 0 failed                                                                                                  |
| `npm run build`                                                  | Passed; every page and Route Handler compiled                                                                        |
| Running development server                                       | Started successfully                                                                                                 |
| HTTP smoke checks                                                | 60 passed across all five roles                                                                                      |
| Full API repair workflow                                         | Submit, review, assign, accept, start, work log, material usage, complete, feedback: passed                          |
| API and page permissions                                         | Missing login, wrong role and another reporter's complaint: checked                                                  |
| Admin APIs                                                       | Create, edit and delete a department: passed                                                                         |
| Inventory concurrency                                            | Two serialized requests cannot spend the same final unit: passed                                                     |
| Source scope                                                     | 14 entity interfaces; PostgreSQL directory contains TODO-only placeholders; no database/ORM/migration implementation |

The HTTP smoke script is included as `scripts/http-smoke.mjs`. Start the local development server, then run `npm run test:http` in another terminal. The script uses its own demo cookies and creates test records. Restart the server afterward to restore initial data.

The final service checks additionally confirm that material detail includes the inventory item name. Source formatting was applied with Prettier.

## Limits

Browser interaction and visual layout were not verified. The managed browser preview launcher supplied `--host` and `--strictPort`, which Next.js does not accept, so that preview could not start. Direct Next.js startup, HTTP rendering, API behavior, type checking and production compilation were verified independently. No screenshots are claimed as completed evidence.

This is a single-process mock-data academic app. Real database persistence, real password authentication, transactions, triggers, stored routines, views, indexes and hosting remain outside this delivery. See DATABASE_TODO.md. Mock serialization prevents interleaving but cannot provide durable rollback.
