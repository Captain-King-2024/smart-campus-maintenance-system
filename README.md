# CampusCare

Smart Campus Maintenance and Complaint Management System — an academic Next.js application with a working frontend, Route Handler APIs, five roles, and selectable **PostgreSQL or in-memory repositories**. All 14 entities are implemented. Follow [PostgreSQL setup](database/README.md) to initialize your database and enable persistent records.

## Start on Windows, macOS, or Linux

Install Node.js 20.9+ (a current LTS version is recommended). Clone this repository or extract the ZIP, then open a terminal in the project root:

```bash
npm ci
npm run dev
```

Open **http://localhost:3000**, select **Demo sign in**, then choose a role. Frontend and backend run together; no second server or database is needed. No `.env` file is required. To enable persistence, copy `.env.example` to `.env.local`, set your `DATABASE_URL`, and follow [database/README.md](database/README.md). Set `DATA_PROVIDER=mock` to use the original in-memory demo.

For a production build running locally:

```bash
npm run build
npm start
```

Use `npm run dev` for a classroom demonstration over plain HTTP. Production cookies use `Secure`; access production via HTTPS for reliable authentication in a deployed environment. Production hosting is not configured in this package.

## Demo users

No password is used. The chooser at `/login` loads the first active user of each role from the selected provider. The table below lists **mock-mode users**; PostgreSQL seed IDs and names are listed in [database setup](database/README.md). Sessions are random, opaque server-side tokens in HttpOnly cookies and expire after 8 hours.

| ID  | Name          | Role                | Demo email        |
| --- | ------------- | ------------------- | ----------------- |
| 1   | Anku Sharma   | STUDENT             | anku@campus.demo  |
| 2   | Dr. Meera Rao | FACULTY             | meera@campus.demo |
| 3   | Ravi Kumar    | TECHNICIAN          | ravi@campus.demo  |
| 4   | Priya Nair    | MAINTENANCE_MANAGER | priya@campus.demo |
| 5   | Campus Admin  | ADMIN               | admin@campus.demo |
| 6   | Asha Patel    | TECHNICIAN          | asha@campus.demo  |
| 7   | Imran Khan    | TECHNICIAN          | imran@campus.demo |

In mock mode the five cards cover IDs 1–5. IDs 6 and 7 are additional technician profiles; for API testing, `POST /api/auth/login` accepts their `user_id` too. Real authentication must replace the demo provider before public use. The demo login intentionally lets anyone select any role.

## What works

- Student/faculty complaint submission with building-dependent rooms, priority and category defaults.
- Own-complaint dashboards, search, status/priority/category filters, timelines, resolution metrics and feedback.
- Manager overview with submitted, unassigned, active and critical counts; availability and low stock.
- Manager filtering by category, building, priority, status and technician; review/reject, assignment, reassignment, priority changes and closure.
- Technician acceptance, start, hold, resume, work logs, material usage and completion.
- Inventory cost and stock checks, positive quantity validation and mock stock reduction through `recordMaterialUsage()`.
- Admin create/edit/delete forms for users, departments, buildings, rooms, categories and teams, with reference and duplicate checks.
- Protected pages, API role checks, complaint ownership, assignment ownership and status transition validation.
- Responsive sidebar, tables, search, cards, empty/loading/error states and form validation.

## Pages

| Audience                     | Routes                                                                                                                            |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Public                       | `/`, `/login`                                                                                                                     |
| Student / faculty            | `/dashboard`, `/complaints`, `/complaints/new`, `/complaints/[id]`                                                                |
| Manager / admin              | `/manager/dashboard`, `/manager/complaints`, `/manager/complaints/[id]`, `/manager/technicians`, `/manager/teams`                 |
| Technician                   | `/technician/dashboard`, `/technician/assignments`, `/technician/assignments/[id]`                                                |
| Technician / manager / admin | `/inventory`                                                                                                                      |
| Admin                        | `/admin/dashboard`, `/admin/users`, `/admin/departments`, `/admin/buildings`, `/admin/rooms`, `/admin/categories`, `/admin/teams` |

Wrong-role page visits redirect to the current user's home dashboard. API authorization remains independent of navigation.

## API

All endpoints except login and session discovery require the session cookie. Success responses are `{ "data": ... }`; errors are `{ "error": "...", "details": [...] }` when validation details apply. IDs are positive integers. Bodies must be JSON. Authentication uses a cookie, never a client-supplied role.

| Methods       | Endpoint                                                         | Purpose                                                  |
| ------------- | ---------------------------------------------------------------- | -------------------------------------------------------- |
| POST          | `/api/auth/login`                                                | Demo login with `{ "user_id": 1 }`                       |
| GET           | `/api/auth/session`                                              | Current user or null                                     |
| POST          | `/api/auth/logout`                                               | Invalidate session                                       |
| GET           | `/api/catalog`                                                   | Reference lists and minimal user directory               |
| GET           | `/api/dashboard`                                                 | Role-scoped metrics and recent complaints                |
| GET, POST     | `/api/complaints`                                                | List scoped complaints / create                          |
| GET, PATCH    | `/api/complaints/[id]`                                           | Detail with related records / manager priority or status |
| GET           | `/api/categories`                                                | Categories                                               |
| GET           | `/api/buildings`                                                 | Buildings                                                |
| GET           | `/api/buildings/[id]/rooms`                                      | Rooms in one building                                    |
| GET           | `/api/rooms`                                                     | Room reference list                                      |
| GET           | `/api/technicians`                                               | Technician profiles for operations roles                 |
| GET, POST     | `/api/assignments`                                               | Role-scoped assignments / manager assignment             |
| GET, PATCH    | `/api/assignments/[id]`                                          | Assignment and complaint detail / technician action      |
| GET, POST     | `/api/work-logs`                                                 | Visible work logs / assigned technician log              |
| GET           | `/api/inventory`                                                 | Stock for operations roles                               |
| GET, POST     | `/api/materials`                                                 | Visible usage / active technician material allocation    |
| GET, POST     | `/api/feedback`                                                  | Visible feedback / reporter feedback after resolution    |
| GET, POST     | `/api/users`, `/api/departments`                                 | Admin lists and creation                                 |
| POST          | `/api/buildings`, `/api/rooms`, `/api/categories`                | Admin creation                                           |
| GET, POST     | `/api/teams`                                                     | Operations list / admin creation                         |
| PATCH, DELETE | `/api/{users,departments,buildings,rooms,categories,teams}/[id]` | Admin update / reference-safe deletion                   |

Complaint query parameters: `search`, `status`, `priority`, `category_id`, `building_id`, `technician_id`. Related list endpoints accept `assignment_id` for work logs and `complaint_id` for materials/feedback. IDs are looked up within authorized records.

Examples of write bodies:

```json
{
  "title": "Projector not turning on",
  "description": "The projector in Room 101 does not power on.",
  "category_id": 4,
  "building_id": 1,
  "room_id": 1,
  "priority": "MEDIUM"
}
```

```json
{ "complaint_id": 13, "technician_id": 1 }
```

```json
{ "action": "accept" }
```

Assignment action values: `accept`, `start`, `hold`, `complete`. Work log body: `assignment_id`, `work_description`, `hours_worked`. Material body: `complaint_id`, `item_id`, `quantity_used`. Feedback body: `complaint_id`, `rating`, `comments`. Priority/status patches contain only the desired supported fields. Admin PATCH sends the complete form record, excluding its generated ID.

API errors use 400 for invalid fields, 401 for missing session, 403 for role/ownership, 404 for missing records, 409 for invalid state/stock/duplicates/references and 415 for non-JSON mutation bodies. Unsupported methods are handled by Next.js with 405.

## Folder structure

```text
smart-campus-maintenance-system/
  database/              # Supplied SQL, compatibility migration, setup guide
  src/
    app/                 # Public/protected pages and explicit api route.ts files
      api/
      admin/
      complaints/
      dashboard/
      inventory/
      login/
      manager/
      technician/
    components/          # Browser UI and API client, no data-access logic
    types/models.ts      # Exactly 14 supplied entity interfaces
    lib/                 # Demo auth, validation, permissions, HTTP adapter, mock lock
    services/            # Complaint, assignment, stock, feedback and admin rules
    repositories/
      interfaces/        # Generic typed contracts + complaint-specific interface
      mock/              # Array-backed implementation
      postgres/          # 14 PostgreSQL repositories + shared parameterized CRUD
      index.ts           # Provider selection and mutation transaction boundary
    data/mock/seed.ts     # Realistic demonstration records
  tests/                 # Service workflow and authorization regression tests
  docs/
    ARCHITECTURE.md
    DATABASE_TODO.md
    DEMO_GUIDE.md
    VERIFICATION.md
  .env.example
  package.json
  package-lock.json
```

## Architecture and database handoff

Browser UI → Route Handler → Service → Repository interface → selected provider.

`DATA_PROVIDER=postgres` selects the pooled PostgreSQL implementation; an unset provider or `mock` selects the original in-memory demo. See [database/README.md](database/README.md) for SQL run order, environment settings and the exact seed login IDs. Your four original SQL files are preserved, with a separate compatibility migration for hold/resume.

Mutations share one transaction and a transaction-scoped advisory lock across server processes. The database triggers own complaint history and inventory deduction. The backend retains validation and role/ownership checks. PostgreSQL data survives server restarts; demo sessions do not. Real credential authentication and durable sessions remain future work.

## Mock data lifecycle

Data is initialized lazily from `src/data/mock/seed.ts`: 12 complaints across 4 buildings, 6 categories, 12 rooms, 7 users, 3 technicians, 2 teams and 5 inventory items, plus assignments, snapshot status history and work logs. New feedback and usage appear as you demonstrate the workflow. Restart the Node process to reset everything. Seed history is a concise demonstration snapshot; new complaint histories record each action.

In mock mode, the state and sessions live only in a **single Node process**. They are shared by browser sessions on that process, disappear on restart, and are unsuitable for serverless instances or multiple workers. Only run one server for a demo. No localStorage or disk database is used. Disabling a user ends their effective access; inactive teams cannot receive new assignments. BUSY technicians can receive additional work; OFF_DUTY technicians cannot. Low stock means fewer than 5 units. Availability returns to AVAILABLE when all active jobs finish.

Admin user creation maintains User records only; creating a technician login does not automatically create a Technician profile or change the entity design. The supplied mock technician profiles support the demonstration. Real account onboarding and technician provisioning are future integration work.

## Checks

```bash
npm run typecheck
npm test
npm run build
```

With `npm run dev` running in a separate terminal, use `node scripts/http-smoke.mjs` to repeat the HTTP workflow checks. Override `SMOKE_BASE_URL` if using another port. The script creates one demo complaint and department and checks all roles.

`npm test` exercises real service behavior with isolated fresh mock stores. See `docs/VERIFICATION.md` for the verification record and PostgreSQL test instructions, and `docs/DEMO_GUIDE.md` for a presentation walkthrough.
