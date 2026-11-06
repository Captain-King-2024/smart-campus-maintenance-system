'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type {
  User,
  Complaint,
  ComplaintAssignment,
  ComplaintStatusHistory,
  WorkLog,
  ComplaintMaterial,
  Feedback,
  ComplaintCategory,
  Building,
  Room,
  Technician,
  MaintenanceTeam,
  InventoryItem,
} from '@/types/models';
import { statuses, priorities, roles } from '@/types/models';
import { api } from './api-client';
type Catalog = {
  categories: ComplaintCategory[];
  buildings: Building[];
  rooms: Room[];
  users: Pick<User, 'user_id' | 'name' | 'role'>[];
  technicians: Technician[];
  teams: MaintenanceTeam[];
};
type Detail = {
  complaint: Complaint;
  assignments: ComplaintAssignment[];
  history: ComplaintStatusHistory[];
  workLogs: WorkLog[];
  materials: ComplaintMaterial[];
  materialItems: Pick<InventoryItem, 'item_id' | 'item_name'>[];
  feedback: Feedback | null;
  assignment?: ComplaintAssignment;
};
type Stats = {
  total: number;
  active: number;
  resolved: number;
  average_resolution_hours: number | null;
  submitted: number;
  unassigned: number;
  critical: number;
  available: number;
  busy: number;
  lowStock: InventoryItem[];
  assigned: number;
  working: number;
  completed: number;
  recent: Complaint[];
};
type AnyRow = Record<string, string | number | null>;
const label = (s: string) =>
  s
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
const date = (s: string | null) =>
  s ? new Date(s).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
const money = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n);
export function Badge({ value }: { value: string }) {
  return <span className={'badge ' + value.toLowerCase()}>{label(value)}</span>;
}
function Header({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">CAMPUS OPERATIONS</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
function Empty({ text = 'No records to show.' }: { text?: string }) {
  return (
    <div className="empty">
      <span>◈</span>
      <p>{text}</p>
    </div>
  );
}
function Field({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span>{title}</span>
      {children}
    </label>
  );
}
function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
function ComplaintTable({
  rows,
  catalog,
  manager = false,
}: {
  rows: Complaint[];
  catalog: Catalog;
  manager?: boolean;
}) {
  if (!rows.length) return <Empty text="No complaints match your filters." />;
  return (
    <Table headers={['Complaint', 'Category / location', 'Priority', 'Status', 'Reported']}>
      {rows.map((c) => (
        <tr key={c.complaint_id}>
          <td>
            <Link
              className="row-link"
              href={`${manager ? '/manager' : ''}/complaints/${c.complaint_id}`}
            >
              <small className="record-id">CMP-{String(c.complaint_id).padStart(3, '0')}</small>
              <strong>{c.title}</strong>
            </Link>
          </td>
          <td>
            {catalog.categories.find((x) => x.category_id === c.category_id)?.category_name}
            <small>
              {catalog.buildings.find((x) => x.building_id === c.building_id)?.building_name}
            </small>
          </td>
          <td>
            <Badge value={c.priority} />
          </td>
          <td>
            <Badge value={c.status} />
          </td>
          <td className="nowrap">{date(c.reported_at)}</td>
        </tr>
      ))}
    </Table>
  );
}
export function Workspace({ user, path }: { user: User; path: string }) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [rows, setRows] = useState<Complaint[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [jobs, setJobs] = useState<ComplaintAssignment[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [adminRows, setAdminRows] = useState<AnyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const tech = user.role === 'TECHNICIAN';
  const manager = ['ADMIN', 'MAINTENANCE_MANAGER'].includes(user.role);
  const section = path.split('/').filter(Boolean);
  const isDetail = /\/\d+$/.test(path);
  const isAdmin = path.startsWith('/admin/') && !path.endsWith('dashboard');
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [cat, st] = await Promise.all([api<Catalog>('/catalog'), api<Stats>('/dashboard')]);
      setCatalog(cat);
      setStats(st);
      if (isDetail) {
        setDetail(
          await api<Detail>(
            path.startsWith('/technician')
              ? '/assignments/' + section.at(-1)
              : '/complaints/' + section.at(-1),
          ),
        );
      } else if (isAdmin) setAdminRows(await api<AnyRow[]>('/' + section[1]));
      else if (path === '/inventory') setItems(await api<InventoryItem[]>('/inventory'));
      else if (tech) setJobs(await api<ComplaintAssignment[]>('/assignments'));
      else if (path.endsWith('/complaints')) setRows(await api<Complaint[]>('/complaints'));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
    // path is the routing dependency; remaining values are derived from it or fixed session role.
  }, [path, user.role]);
  useEffect(() => {
    void load();
  }, [load]);
  async function act(endpoint: string, method: string, payload?: unknown) {
    setError('');
    setNotice('');
    try {
      await api(endpoint, method, payload);
      await load();
      setNotice('Changes saved successfully.');
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  }
  if (loading)
    return (
      <div className="loading" role="status">
        Loading your workspace…
      </div>
    );
  if (!catalog || !stats)
    return (
      <>
        <p role="alert" className="error">
          {error || 'Unable to load workspace'}
        </p>
        <button className="button" onClick={load}>
          Retry
        </button>
      </>
    );
  return (
    <>
      {error && (
        <div role="alert" className="error">
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className="notice">
          {notice}
        </div>
      )}
      {isDetail ? (
        detail ? (
          <ComplaintDetail user={user} data={detail} catalog={catalog} act={act} />
        ) : (
          <Empty text="The requested record could not be loaded." />
        )
      ) : path === '/complaints/new' ? (
        <NewComplaint catalog={catalog} />
      ) : isAdmin ? (
        <AdminScreen entity={section[1]} rows={adminRows} catalog={catalog} act={act} />
      ) : path === '/inventory' ? (
        <>
          <Header
            title="Inventory"
            description="Know what is available before you start a repair."
          />
          <div className="panel">
            <div className="panel-heading">
              <h2>Materials & supplies</h2>
              <span className="muted">Low stock: fewer than 5 units</span>
            </div>
            <Table
              headers={['Item code', 'Material', 'Available quantity', 'Unit cost', 'Stock level']}
            >
              {items.map((i) => (
                <tr key={i.item_id}>
                  <td className="record-id">{i.item_code}</td>
                  <td>
                    <strong>{i.item_name}</strong>
                  </td>
                  <td>{i.quantity_available}</td>
                  <td>{money(i.unit_cost)}</td>
                  <td>
                    <Badge value={i.quantity_available < 5 ? 'LOW_STOCK' : 'AVAILABLE'} />
                  </td>
                </tr>
              ))}
            </Table>
          </div>
        </>
      ) : path === '/manager/technicians' ? (
        <>
          <Header title="Technicians" description="The people keeping your campus running." />
          <div className="panel">
            <Table
              headers={[
                'Technician',
                'Employee code',
                'Team',
                'Specialization',
                'Availability',
                'Experience',
              ]}
            >
              {catalog.technicians.map((t) => (
                <tr key={t.technician_id}>
                  <td>
                    <strong>{catalog.users.find((u) => u.user_id === t.user_id)?.name}</strong>
                  </td>
                  <td>{t.employee_code}</td>
                  <td>{catalog.teams.find((x) => x.team_id === t.team_id)?.team_name}</td>
                  <td>{t.specialization}</td>
                  <td>
                    <Badge value={t.availability_status} />
                  </td>
                  <td>{t.experience_years} years</td>
                </tr>
              ))}
            </Table>
          </div>
        </>
      ) : path === '/manager/teams' ? (
        <>
          <Header title="Maintenance teams" description="Specialist teams, working together." />
          <div className="team-grid">
            {catalog.teams.map((t) => (
              <article key={t.team_id} className="panel team-card">
                <Badge value={t.status} />
                <h2>{t.team_name}</h2>
                <p>{t.specialization}</p>
                <small>
                  Managed by {catalog.users.find((u) => u.user_id === t.manager_id)?.name}
                </small>
                <hr />
                {catalog.technicians
                  .filter((x) => x.team_id === t.team_id)
                  .map((x) => (
                    <p className="team-person" key={x.technician_id}>
                      {catalog.users.find((u) => u.user_id === x.user_id)?.name}
                      <Badge value={x.availability_status} />
                    </p>
                  ))}
              </article>
            ))}
          </div>
        </>
      ) : path.endsWith('/complaints') ? (
        <ComplaintList rows={rows} catalog={catalog} manager={manager} />
      ) : path === '/technician/assignments' ? (
        <>
          <Header
            title="My assignments"
            description="Accept, repair, and document your assigned work."
          />
          <AssignmentTable jobs={jobs} catalog={catalog} />
        </>
      ) : (
        <>
          <Header
            title={
              tech
                ? 'Your repair workspace'
                : manager
                  ? 'Campus overview'
                  : 'Your campus, cared for.'
            }
            description={
              tech
                ? 'A clear view of your work, from assignment to completion.'
                : manager
                  ? 'Track requests, coordinate your team, and keep the campus moving.'
                  : 'Report issues and follow every step of the repair.'
            }
            action={
              !manager && !tech ? (
                <Link className="button" href="/complaints/new">
                  ＋ Report an issue
                </Link>
              ) : (
                <span className="date-chip">
                  {new Date().toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
              )
            }
          />
          <div className="stat-grid">
            {(tech
              ? [
                  ['Assigned work', stats.assigned, 'Awaiting action or in progress'],
                  ['Active repairs', stats.working, 'Work currently underway'],
                  ['Completed jobs', stats.completed, 'Repairs you have finished'],
                ]
              : manager
                ? [
                    ['All complaints', stats.total, 'Across the campus'],
                    ['Unassigned', stats.unassigned, 'Waiting for a technician'],
                    ['Active requests', stats.active, 'Work still to be resolved'],
                    ['Critical issues', stats.critical, 'Needs immediate attention'],
                  ]
                : [
                    ['Complaints submitted', stats.total, 'All your reported issues'],
                    ['Active requests', stats.active, 'We are working on these'],
                    ['Resolved', stats.resolved, 'Back in working order'],
                    [
                      'Avg. resolution',
                      stats.average_resolution_hours === null
                        ? '—'
                        : stats.average_resolution_hours + 'h',
                      'From report to resolution',
                    ],
                  ]
            ).map(([title, value, caption], i) => (
              <article className={'stat-card stat-' + i} key={String(title)}>
                <span>{title}</span>
                <strong>{value}</strong>
                <small>{caption}</small>
              </article>
            ))}
          </div>
          {manager && (
            <div className="summary-strip">
              <span>
                <i className="green-dot" />
                {stats.available} technicians available
              </span>
              <span>{stats.busy} currently busy</span>
              <span>{stats.submitted} newly submitted</span>
              <span>{stats.lowStock.length} materials low on stock</span>
            </div>
          )}
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>{tech ? 'Assigned work' : 'Recent complaints'}</h2>
                <p className="muted">
                  {tech ? 'Your next steps, in one place.' : 'The latest maintenance updates.'}
                </p>
              </div>
              <Link
                className="text-link"
                href={
                  tech ? '/technician/assignments' : manager ? '/manager/complaints' : '/complaints'
                }
              >
                View all →
              </Link>
            </div>
            {tech ? (
              <AssignmentTable
                jobs={jobs.filter((a) => a.assignment_status !== 'CANCELLED').slice(0, 6)}
                catalog={catalog}
              />
            ) : (
              <ComplaintTable rows={stats.recent} catalog={catalog} manager={manager} />
            )}
          </section>
          {manager && stats.lowStock.length > 0 && (
            <section className="panel stock-panel">
              <h2>Supplies need attention</h2>
              <p className="muted">Plan ahead for upcoming repairs.</p>
              <div className="stock-grid">
                {stats.lowStock.map((i) => (
                  <div key={i.item_id}>
                    <strong>{i.item_name}</strong>
                    <span>{i.quantity_available} units remaining</span>
                  </div>
                ))}
              </div>
              <Link className="text-link" href="/inventory">
                View inventory →
              </Link>
            </section>
          )}
          {user.role === 'ADMIN' && (
            <section className="panel stock-panel">
              <h2>Campus directory</h2>
              <p className="muted">
                Maintain the people, places, categories, and teams behind every request.
              </p>
              <div className="quick-links">
                {['users', 'departments', 'buildings', 'rooms', 'categories', 'teams'].map((k) => (
                  <Link key={k} href={'/admin/' + k}>
                    {label(k)} ↗
                  </Link>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </>
  );
}
function ComplaintList({
  rows,
  catalog,
  manager,
}: {
  rows: Complaint[];
  catalog: Catalog;
  manager: boolean;
}) {
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const update = (key: string, value: string) => setFilters((f) => ({ ...f, [key]: value }));
  const visible = rows.filter(
    (c) =>
      (!search ||
        `${c.title} ${c.complaint_id} ${c.description}`
          .toLowerCase()
          .includes(search.toLowerCase())) &&
      Object.entries(filters).every(
        ([key, value]) =>
          !value || (key === 'technician_id' ? false : String(c[key as keyof Complaint]) === value),
      ),
  );
  // Technician filtering goes through the API because assignments are a related entity.
  const [remote, setRemote] = useState<Complaint[] | null>(null);
  const [filterError, setFilterError] = useState('');
  useEffect(() => {
    if (!filters.technician_id) {
      setRemote(null);
      return;
    }
    let live = true;
    api<Complaint[]>('/complaints?technician_id=' + filters.technician_id)
      .then((r) => {
        if (live) {
          setRemote(r);
          setFilterError('');
        }
      })
      .catch((e) => {
        if (live) setFilterError(e.message);
      });
    return () => {
      live = false;
    };
  }, [filters.technician_id]);
  const filtered = filters.technician_id
    ? (remote ?? []).filter(
        (c) =>
          (!search ||
            `${c.title} ${c.complaint_id}`.toLowerCase().includes(search.toLowerCase())) &&
          Object.entries(filters).every(
            ([k, v]) => k === 'technician_id' || !v || String(c[k as keyof Complaint]) === v,
          ),
      )
    : visible;
  return (
    <>
      <Header
        title={manager ? 'All complaints' : 'My complaints'}
        description={
          manager
            ? 'Review campus requests and coordinate the next step.'
            : 'Every issue you reported, with its latest status.'
        }
        action={
          !manager ? (
            <Link className="button" href="/complaints/new">
              ＋ Report an issue
            </Link>
          ) : undefined
        }
      />
      <div className="panel">
        <div className="filters">
          <Field title="Search">
            <input
              placeholder="Search title or ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </Field>
          {[
            ['status', statuses.map((x) => [x, label(x)])],
            ['priority', priorities.map((x) => [x, label(x)])],
            [
              'category_id',
              catalog.categories.map((x) => [String(x.category_id), x.category_name]),
            ],
            ...(manager
              ? [
                  [
                    'building_id',
                    catalog.buildings.map((x) => [String(x.building_id), x.building_name]),
                  ],
                  [
                    'technician_id',
                    catalog.technicians.map((x) => [
                      String(x.technician_id),
                      catalog.users.find((u) => u.user_id === x.user_id)?.name ?? x.employee_code,
                    ]),
                  ],
                ]
              : []),
          ].map(([key, options]) => (
            <Field key={String(key)} title={label(String(key).replace('_id', ''))}>
              <select
                value={filters[String(key)] ?? ''}
                onChange={(e) => update(String(key), e.target.value)}
              >
                <option value="">All</option>
                {(options as string[][]).map(([v, n]) => (
                  <option key={v} value={v}>
                    {n}
                  </option>
                ))}
              </select>
            </Field>
          ))}
          <button
            className="text-button"
            onClick={() => {
              setFilters({});
              setSearch('');
            }}
          >
            Clear
          </button>
        </div>
        {filterError && (
          <p role="alert" className="error">
            {filterError}
          </p>
        )}
        <div className="results-count">
          {filtered.length} request{filtered.length !== 1 ? 's' : ''}
        </div>
        <ComplaintTable rows={filtered} catalog={catalog} manager={manager} />
      </div>
    </>
  );
}
function NewComplaint({ catalog }: { catalog: Catalog }) {
  const [building, setBuilding] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [priority, setPriority] = useState('MEDIUM');
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError('');
    try {
      const c = await api<Complaint>('/complaints', 'POST', {
        title: f.get('title'),
        description: f.get('description'),
        category_id: Number(f.get('category_id')),
        building_id: Number(building),
        room_id: f.get('room_id') ? Number(f.get('room_id')) : null,
        priority,
      });
      window.location.assign('/complaints/' + c.complaint_id);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }
  return (
    <>
      <Header
        title="Report an issue"
        description="Tell us what needs attention. We will take it from here."
      />
      <div className="form-layout">
        <form className="panel form-panel" onSubmit={submit}>
          <h2>Complaint details</h2>
          <p className="muted">Fields marked * are required.</p>
          <Field title="Title *">
            <input
              name="title"
              required
              maxLength={160}
              placeholder="e.g. Projector not turning on"
            />
          </Field>
          <Field title="Description *">
            <textarea
              name="description"
              required
              maxLength={4000}
              rows={5}
              placeholder="Describe what happened and how it affects the space."
            />
          </Field>
          <div className="form-grid">
            <Field title="Category *">
              <select
                name="category_id"
                required
                defaultValue=""
                onChange={(e) => {
                  const c = catalog.categories.find(
                    (c) => c.category_id === Number(e.target.value),
                  );
                  if (c) setPriority(c.default_priority);
                }}
              >
                <option value="" disabled>
                  Select category
                </option>
                {catalog.categories.map((c) => (
                  <option key={c.category_id} value={c.category_id}>
                    {c.category_name}
                  </option>
                ))}
              </select>
            </Field>
            <Field title="Priority *">
              <select value={priority} onChange={(e) => setPriority(e.target.value)}>
                {priorities.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </Field>
            <Field title="Building *">
              <select required value={building} onChange={(e) => setBuilding(e.target.value)}>
                <option value="" disabled>
                  Select building
                </option>
                {catalog.buildings.map((b) => (
                  <option key={b.building_id} value={b.building_id}>
                    {b.building_name}
                  </option>
                ))}
              </select>
            </Field>
            <Field title="Room (optional)">
              <select name="room_id" key={building} disabled={!building} defaultValue="">
                <option value="">Common area / no room</option>
                {catalog.rooms
                  .filter((r) => r.building_id === Number(building))
                  .map((r) => (
                    <option key={r.room_id} value={r.room_id}>
                      {r.room_number} · Floor {r.floor_number}
                    </option>
                  ))}
              </select>
            </Field>
          </div>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <div className="form-actions">
            <Link className="button secondary" href="/complaints">
              Cancel
            </Link>
            <button disabled={busy} className="button">
              {busy ? 'Submitting…' : 'Submit complaint →'}
            </button>
          </div>
        </form>
        <aside className="help-card">
          <div className="eyebrow">WHAT HAPPENS NEXT?</div>
          <h2>
            You report.
            <br />
            We coordinate.
          </h2>
          <ol>
            <li>A maintenance manager reviews your request.</li>
            <li>A technician is assigned to inspect and repair.</li>
            <li>Follow the timeline for updates.</li>
            <li>Share your feedback once it is resolved.</li>
          </ol>
          <p>For immediate danger, contact campus emergency services directly.</p>
        </aside>
      </div>
    </>
  );
}
function AssignmentTable({ jobs, catalog }: { jobs: ComplaintAssignment[]; catalog: Catalog }) {
  if (!jobs.length) return <Empty text="No assignments yet." />;
  return (
    <div className="panel">
      <Table headers={['Assignment', 'Complaint', 'Assigned', 'Started', 'Work status']}>
        {jobs.map((a) => (
          <tr key={a.assignment_id}>
            <td>
              <Link className="text-link" href={'/technician/assignments/' + a.assignment_id}>
                JOB-{String(a.assignment_id).padStart(3, '0')} →
              </Link>
            </td>
            <td>CMP-{String(a.complaint_id).padStart(3, '0')}</td>
            <td>{date(a.assigned_at)}</td>
            <td>{date(a.started_at)}</td>
            <td>
              <Badge value={a.assignment_status} />
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
type Action = (endpoint: string, method: string, payload?: unknown) => Promise<boolean>;
function ComplaintDetail({
  user,
  data,
  catalog,
  act,
}: {
  user: User;
  data: Detail;
  catalog: Catalog;
  act: Action;
}) {
  const { complaint: c, assignments: jobs } = data;
  const manager = ['ADMIN', 'MAINTENANCE_MANAGER'].includes(user.role);
  const tech = user.role === 'TECHNICIAN';
  const a = data.assignment;
  const active = jobs.find((j) => !['CANCELLED', 'COMPLETED'].includes(j.assignment_status));
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState('');
  const [stock, setStock] = useState<InventoryItem[]>([]);
  useEffect(() => {
    if (tech)
      api<InventoryItem[]>('/inventory')
        .then(setStock)
        .catch((e) => setLocalError(e.message));
  }, [tech]);
  async function run(endpoint: string, payload: unknown, method = 'POST') {
    setBusy(true);
    const done = await act(endpoint, method, payload);
    setBusy(false);
    return done;
  }
  async function form(
    e: React.FormEvent<HTMLFormElement>,
    endpoint: string,
    build: (f: FormData) => unknown,
  ) {
    e.preventDefault();
    const el = e.currentTarget;
    const done = await run(endpoint, build(new FormData(el)));
    if (done) el.reset();
  }
  return (
    <>
      <Link
        className="back-link"
        href={tech ? '/technician/assignments' : manager ? '/manager/complaints' : '/complaints'}
      >
        ← Back to {tech ? 'assignments' : 'complaints'}
      </Link>
      <Header
        title={c.title}
        description={`CMP-${String(c.complaint_id).padStart(3, '0')} · Reported ${date(c.reported_at)}`}
        action={<Badge value={c.status} />}
      />
      {localError && (
        <p className="error" role="alert">
          {localError}
        </p>
      )}
      <div className="detail-layout">
        <div>
          <section className="panel detail-panel">
            <h2>Request details</h2>
            <p className="description">{c.description}</p>
            <dl className="details-grid">
              <div>
                <dt>Category</dt>
                <dd>
                  {catalog.categories.find((x) => x.category_id === c.category_id)?.category_name}
                </dd>
              </div>
              <div>
                <dt>Location</dt>
                <dd>
                  {catalog.buildings.find((x) => x.building_id === c.building_id)?.building_name}
                  {c.room_id
                    ? ' · Room ' + catalog.rooms.find((x) => x.room_id === c.room_id)?.room_number
                    : ' · Common area'}
                </dd>
              </div>
              <div>
                <dt>Priority</dt>
                <dd>
                  <Badge value={c.priority} />
                </dd>
              </div>
              <div>
                <dt>Expected resolution</dt>
                <dd>{date(c.expected_resolution_at)}</dd>
              </div>
              <div>
                <dt>Reported by</dt>
                <dd>{catalog.users.find((x) => x.user_id === c.reported_by)?.name}</dd>
              </div>
              <div>
                <dt>Resolved at</dt>
                <dd>{date(c.resolved_at)}</dd>
              </div>
            </dl>
          </section>
          {manager && (
            <section className="panel detail-panel">
              <h2>Manage request</h2>
              <div className="inline-actions">
                {c.status === 'SUBMITTED' && (
                  <button
                    disabled={busy}
                    className="button secondary"
                    onClick={() =>
                      run('/complaints/' + c.complaint_id, { status: 'UNDER_REVIEW' }, 'PATCH')
                    }
                  >
                    Mark under review
                  </button>
                )}
                {['SUBMITTED', 'UNDER_REVIEW'].includes(c.status) && (
                  <button
                    disabled={busy}
                    className="button danger"
                    onClick={() =>
                      run('/complaints/' + c.complaint_id, { status: 'REJECTED' }, 'PATCH')
                    }
                  >
                    Reject complaint
                  </button>
                )}
                {c.status === 'RESOLVED' && (
                  <button
                    disabled={busy}
                    className="button"
                    onClick={() =>
                      run('/complaints/' + c.complaint_id, { status: 'CLOSED' }, 'PATCH')
                    }
                  >
                    Close complaint
                  </button>
                )}
                <Field title="Priority">
                  <select
                    value={c.priority}
                    disabled={busy}
                    onChange={(e) =>
                      run('/complaints/' + c.complaint_id, { priority: e.target.value }, 'PATCH')
                    }
                  >
                    {priorities.map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </Field>
              </div>
              {!['RESOLVED', 'CLOSED', 'REJECTED'].includes(c.status) && (
                <form
                  onSubmit={(e) =>
                    form(e, '/assignments', (f) => ({
                      complaint_id: c.complaint_id,
                      technician_id: Number(f.get('technician_id')),
                    }))
                  }
                >
                  <Field title={active ? 'Reassign technician' : 'Assign technician'}>
                    <select name="technician_id" required defaultValue="">
                      <option value="" disabled>
                        Choose a technician
                      </option>
                      {catalog.technicians
                        .filter(
                          (t) =>
                            t.availability_status !== 'OFF_DUTY' &&
                            t.technician_id !== active?.technician_id,
                        )
                        .map((t) => (
                          <option key={t.technician_id} value={t.technician_id}>
                            {catalog.users.find((u) => u.user_id === t.user_id)?.name} ·{' '}
                            {t.specialization} · {label(t.availability_status)}
                          </option>
                        ))}
                    </select>
                  </Field>
                  <button disabled={busy} className="button">
                    {active ? 'Reassign' : 'Assign'} technician
                  </button>
                </form>
              )}
            </section>
          )}
          {tech && a && (
            <section className="panel detail-panel">
              <h2>
                Your assignment <Badge value={a.assignment_status} />
              </h2>
              <div className="inline-actions">
                {a.assignment_status === 'ASSIGNED' && (
                  <button
                    disabled={busy}
                    className="button"
                    onClick={() =>
                      run('/assignments/' + a.assignment_id, { action: 'accept' }, 'PATCH')
                    }
                  >
                    Accept assignment
                  </button>
                )}
                {['ACCEPTED', 'ON_HOLD'].includes(a.assignment_status) && (
                  <button
                    disabled={busy}
                    className="button"
                    onClick={() =>
                      run('/assignments/' + a.assignment_id, { action: 'start' }, 'PATCH')
                    }
                  >
                    {a.assignment_status === 'ON_HOLD' ? 'Resume' : 'Start'} work
                  </button>
                )}
                {a.assignment_status === 'IN_PROGRESS' && (
                  <>
                    <button
                      disabled={busy}
                      className="button secondary"
                      onClick={() =>
                        run('/assignments/' + a.assignment_id, { action: 'hold' }, 'PATCH')
                      }
                    >
                      Put on hold
                    </button>
                    <button
                      disabled={busy}
                      className="button"
                      onClick={() =>
                        run('/assignments/' + a.assignment_id, { action: 'complete' }, 'PATCH')
                      }
                    >
                      Complete work
                    </button>
                  </>
                )}
              </div>
              {a.assignment_status === 'IN_PROGRESS' && (
                <div className="repair-forms">
                  <form
                    onSubmit={(e) =>
                      form(e, '/work-logs', (f) => ({
                        assignment_id: a.assignment_id,
                        work_description: f.get('work_description'),
                        hours_worked: Number(f.get('hours_worked')),
                      }))
                    }
                  >
                    <h3>Add work log</h3>
                    <Field title="Work description *">
                      <textarea name="work_description" rows={3} required maxLength={4000} />
                    </Field>
                    <Field title="Hours worked *">
                      <input
                        name="hours_worked"
                        type="number"
                        min="0.01"
                        max="24"
                        step="0.01"
                        required
                      />
                    </Field>
                    <button disabled={busy} className="button secondary">
                      Save work log
                    </button>
                  </form>
                  <form
                    onSubmit={(e) =>
                      form(e, '/materials', (f) => ({
                        complaint_id: c.complaint_id,
                        item_id: Number(f.get('item_id')),
                        quantity_used: Number(f.get('quantity_used')),
                      }))
                    }
                  >
                    <h3>Record material usage</h3>
                    <Field title="Inventory item *">
                      <select name="item_id" required defaultValue="">
                        <option value="" disabled>
                          Choose material
                        </option>
                        {stock.map((i) => (
                          <option key={i.item_id} value={i.item_id}>
                            {i.item_name} · {i.quantity_available} available
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field title="Quantity used *">
                      <input
                        name="quantity_used"
                        type="number"
                        min="0.01"
                        max="100000"
                        step="0.01"
                        required
                      />
                    </Field>
                    <button disabled={busy} className="button secondary">
                      Record material
                    </button>
                  </form>
                </div>
              )}
            </section>
          )}
          <section className="panel detail-panel">
            <h2>
              Work logs <span className="count">{data.workLogs.length}</span>
            </h2>
            {data.workLogs.length ? (
              data.workLogs.map((l) => (
                <article className="log" key={l.work_log_id}>
                  <strong>{l.work_description}</strong>
                  <small>
                    {date(l.work_date)} · {l.hours_worked} hours ·{' '}
                    {
                      catalog.users.find(
                        (u) =>
                          u.user_id ===
                          catalog.technicians.find((t) => t.technician_id === l.technician_id)
                            ?.user_id,
                      )?.name
                    }
                  </small>
                </article>
              ))
            ) : (
              <p className="muted">No work has been logged yet.</p>
            )}
          </section>
          <section className="panel detail-panel">
            <h2>Materials used</h2>
            {data.materials.length ? (
              <Table headers={['Material', 'Quantity', 'Unit cost', 'Total']}>
                {data.materials.map((m) => (
                  <tr key={m.complaint_material_id}>
                    <td>
                      {data.materialItems.find((item) => item.item_id === m.item_id)?.item_name ??
                        `Item #${m.item_id}`}
                    </td>
                    <td>{m.quantity_used}</td>
                    <td>{money(m.unit_cost)}</td>
                    <td>{money(m.total_cost)}</td>
                  </tr>
                ))}
              </Table>
            ) : (
              <p className="muted">No materials recorded.</p>
            )}
          </section>
          <section className="panel detail-panel">
            <h2>Feedback</h2>
            {data.feedback ? (
              <>
                <div className="rating">
                  {'★'.repeat(data.feedback.rating)}
                  {'☆'.repeat(5 - data.feedback.rating)}
                </div>
                <p>{data.feedback.comments || 'No comment provided.'}</p>
                <small>{date(data.feedback.submitted_at)}</small>
              </>
            ) : ['RESOLVED', 'CLOSED'].includes(c.status) && c.reported_by === user.user_id ? (
              <form
                onSubmit={(e) =>
                  form(e, '/feedback', (f) => ({
                    complaint_id: c.complaint_id,
                    rating: Number(f.get('rating')),
                    comments: f.get('comments'),
                  }))
                }
              >
                <Field title="How was the repair? *">
                  <select name="rating" required defaultValue="">
                    <option value="" disabled>
                      Choose a rating
                    </option>
                    {[5, 4, 3, 2, 1].map((n) => (
                      <option key={n} value={n}>
                        {n} / 5
                      </option>
                    ))}
                  </select>
                </Field>
                <Field title="Comments">
                  <textarea name="comments" rows={3} maxLength={2000} />
                </Field>
                <button className="button" disabled={busy}>
                  Submit feedback
                </button>
              </form>
            ) : (
              <p className="muted">The reporter can share feedback after resolution.</p>
            )}
          </section>
        </div>
        <aside>
          <section className="panel detail-panel">
            <h2>Status timeline</h2>
            <ol className="timeline">
              {data.history.map((h) => (
                <li key={h.history_id}>
                  <strong>{label(h.new_status)}</strong>
                  <time>{date(h.changed_at)}</time>
                  <small>{catalog.users.find((u) => u.user_id === h.changed_by)?.name}</small>
                </li>
              ))}
            </ol>
          </section>
          <section className="panel detail-panel">
            <h2>Assignment history</h2>
            {jobs.length ? (
              jobs.map((j) => (
                <article className="log" key={j.assignment_id}>
                  <strong>
                    {
                      catalog.users.find(
                        (u) =>
                          u.user_id ===
                          catalog.technicians.find((t) => t.technician_id === j.technician_id)
                            ?.user_id,
                      )?.name
                    }
                  </strong>
                  <Badge value={j.assignment_status} />
                  <small>Assigned {date(j.assigned_at)}</small>
                  <small>Started {date(j.started_at)}</small>
                  <small>Completed {date(j.completed_at)}</small>
                </article>
              ))
            ) : (
              <p className="muted">Waiting for assignment.</p>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
// Plain form configuration maps exactly to the supplied entity interfaces.
const configs: Record<string, { key: string; fields: string[]; numeric: string[] }> = {
  users: {
    key: 'user_id',
    fields: ['name', 'email', 'department_id', 'role', 'status'],
    numeric: ['department_id'],
  },
  departments: {
    key: 'department_id',
    fields: ['department_name', 'department_code', 'department_type'],
    numeric: [],
  },
  buildings: {
    key: 'building_id',
    fields: ['building_name', 'building_code', 'building_type', 'number_of_floors'],
    numeric: ['number_of_floors'],
  },
  rooms: {
    key: 'room_id',
    fields: ['building_id', 'room_number', 'floor_number', 'room_type'],
    numeric: ['building_id', 'floor_number'],
  },
  categories: {
    key: 'category_id',
    fields: ['category_name', 'default_priority', 'expected_resolution_hours'],
    numeric: ['expected_resolution_hours'],
  },
  teams: {
    key: 'team_id',
    fields: ['team_name', 'manager_id', 'specialization', 'status'],
    numeric: ['manager_id'],
  },
};
function AdminScreen({
  entity,
  rows,
  catalog,
  act,
}: {
  entity: string;
  rows: AnyRow[];
  catalog: Catalog;
  act: Action;
}) {
  const config = configs[entity];
  const [editing, setEditing] = useState<AnyRow | null>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [departments, setDepartments] = useState<
    { department_id: number; department_name: string }[]
  >([]);
  useEffect(() => {
    api<{ department_id: number; department_name: string }[]>('/departments')
      .then(setDepartments)
      .catch(() => {});
  }, []);
  const options = (field: string): [string | number, string][] | null =>
    field === 'role'
      ? roles.map((r) => [r, label(r)])
      : field === 'status'
        ? [
            ['ACTIVE', 'Active'],
            ['INACTIVE', 'Inactive'],
          ]
        : field === 'default_priority'
          ? priorities.map((p) => [p, label(p)])
          : field === 'department_id'
            ? departments.map((d) => [d.department_id, d.department_name])
            : field === 'building_id'
              ? catalog.buildings.map((b) => [b.building_id, b.building_name])
              : field === 'manager_id'
                ? catalog.users
                    .filter((u) => ['ADMIN', 'MAINTENANCE_MANAGER'].includes(u.role))
                    .map((u) => [u.user_id, u.name])
                : null;
  const readable = (row: AnyRow, key: string) =>
    options(key)?.find(([v]) => String(v) === String(row[key]))?.[1] ?? String(row[key] ?? '—');
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const payload = Object.fromEntries(
      config.fields.map((k) => [k, config.numeric.includes(k) ? Number(f.get(k)) : f.get(k)]),
    );
    setBusy(true);
    const done = await act(
      '/' + entity + (editing ? '/' + editing[config.key] : ''),
      editing ? 'PATCH' : 'POST',
      payload,
    );
    setBusy(false);
    if (done) {
      setOpen(false);
      setEditing(null);
    }
  }
  async function remove(row: AnyRow) {
    if (!window.confirm('Delete this record? Referenced records cannot be deleted.')) return;
    setBusy(true);
    await act('/' + entity + '/' + row[config.key], 'DELETE');
    setBusy(false);
  }
  return (
    <>
      <Header
        title={label(entity)}
        description={'Manage campus ' + entity + ' in the shared directory.'}
        action={
          <button
            className="button"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            ＋ Add {entity === 'categories' ? 'category' : entity.slice(0, -1)}
          </button>
        }
      />
      {open && (
        <form
          className="panel form-panel admin-form"
          onSubmit={submit}
          key={editing ? String(editing[config.key]) : 'new'}
        >
          <h2>{editing ? 'Edit record' : 'New record'}</h2>
          <div className="form-grid">
            {config.fields.map((k) => (
              <Field key={k} title={label(k.replace('_id', '')) + ' *'}>
                {options(k) ? (
                  <select required name={k} defaultValue={String(editing?.[k] ?? '')}>
                    <option value="" disabled>
                      Select {label(k)}
                    </option>
                    {options(k)!.map(([v, n]) => (
                      <option key={v} value={v}>
                        {n}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    required
                    name={k}
                    type={k === 'email' ? 'email' : config.numeric.includes(k) ? 'number' : 'text'}
                    min={k === 'expected_resolution_hours' ? '0.01' : '0'}
                    max={
                      k === 'number_of_floors' || k === 'floor_number'
                        ? 200
                        : k === 'expected_resolution_hours'
                          ? 8760
                          : undefined
                    }
                    step={k === 'expected_resolution_hours' ? '0.01' : '1'}
                    maxLength={k === 'email' ? 200 : 160}
                    defaultValue={editing?.[k] ?? ''}
                  />
                )}
              </Field>
            ))}
          </div>
          <div className="form-actions">
            <button className="button secondary" type="button" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button className="button" disabled={busy}>
              Save record
            </button>
          </div>
        </form>
      )}
      <div className="panel">
        <div className="filters">
          <Field title="Search directory">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={'Search ' + entity + '…'}
            />
          </Field>
        </div>
        {rows.length ? (
          <Table
            headers={['ID', ...config.fields.map((f) => label(f.replace('_id', ''))), 'Actions']}
          >
            {rows
              .filter((r) =>
                Object.values(r).join(' ').toLowerCase().includes(search.toLowerCase()),
              )
              .map((row) => (
                <tr key={String(row[config.key])}>
                  <td className="record-id">{row[config.key]}</td>
                  {config.fields.map((k) => (
                    <td key={k}>
                      {['role', 'status', 'default_priority'].includes(k) ? (
                        <Badge value={String(row[k])} />
                      ) : (
                        readable(row, k)
                      )}
                    </td>
                  ))}
                  <td>
                    <div className="inline-actions">
                      <button
                        className="text-button"
                        disabled={busy}
                        onClick={() => {
                          setEditing(row);
                          setOpen(true);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="text-button delete"
                        disabled={busy}
                        onClick={() => remove(row)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </Table>
        ) : (
          <Empty />
        )}
      </div>
    </>
  );
}
