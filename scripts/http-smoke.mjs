// Runs against an already-running local development server. No browser dependencies.
import assert from 'node:assert/strict';
const base = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:3000';
let count = 0;
async function call(path, { method = 'GET', body, cookie, expected = 200, origin } = {}) {
  const res = await fetch(base + path, {
    method,
    redirect: 'manual',
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(cookie ? { cookie } : {}),
      ...(origin ? { origin } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const raw = await res.text();
  assert.equal(res.status, expected, `${method} ${path}: ${raw.slice(0, 250)}`);
  count++;
  let data;
  try {
    data = JSON.parse(raw).data;
  } catch {}
  return {
    data,
    cookie: res.headers
      .getSetCookie()
      .filter((c) => c.startsWith('campus_demo_session='))
      .at(-1)
      ?.split(';')[0],
    raw,
    res,
  };
}
const login = async (user_id) =>
  (await call('/api/auth/login', { method: 'POST', body: { user_id } })).cookie;
await call('/');
await call('/login');
await call('/api/complaints', { expected: 401 });
await call('/dashboard', { expected: 307 });
const pg = process.env.DATA_PROVIDER === 'postgres';
const student = await login(pg ? 12 : 1);
const faculty = await login(pg ? 16 : 2);
const tech = await login(pg ? 4 : 3);
const manager = await login(pg ? 2 : 4);
const admin = await login(pg ? 1 : 5);
for (const [cookie, paths] of [
  [student, ['/dashboard', '/complaints', '/complaints/new']],
  [faculty, ['/dashboard']],
  [tech, ['/technician/dashboard', '/technician/assignments', '/inventory']],
  [
    manager,
    ['/manager/dashboard', '/manager/complaints', '/manager/technicians', '/manager/teams'],
  ],
  [
    admin,
    [
      '/admin/dashboard',
      '/admin/users',
      '/admin/departments',
      '/admin/buildings',
      '/admin/rooms',
      '/admin/categories',
      '/admin/teams',
    ],
  ],
])
  for (const path of paths) await call(path, { cookie });
await call('/admin/users', { cookie: student, expected: 307 });
await call('/api/users', { cookie: student, expected: 403 });
for (const path of [
  '/api/catalog',
  '/api/dashboard',
  '/api/categories',
  '/api/buildings',
  '/api/buildings/1/rooms',
  '/api/complaints',
])
  await call(path, { cookie: student });
await call('/api/complaints', {
  method: 'POST',
  cookie: student,
  body: { title: '' },
  expected: 400,
});
await call('/api/complaints', {
  method: 'POST',
  cookie: student,
  body: {},
  origin: 'https://other.invalid',
  expected: 403,
});
const c = (
  await call('/api/complaints', {
    method: 'POST',
    cookie: student,
    body: {
      title: 'HTTP smoke repair',
      description: 'Verify the full server workflow.',
      category_id: 1,
      building_id: 1,
      room_id: 1,
      priority: 'HIGH',
    },
    expected: 201,
  })
).data;
await call('/complaints/' + c.complaint_id, { cookie: student });
await call('/api/complaints/' + c.complaint_id, { cookie: faculty, expected: 403 });
await call('/api/complaints/' + c.complaint_id, {
  method: 'PATCH',
  cookie: manager,
  body: { status: 'UNDER_REVIEW' },
});
const job = (
  await call('/api/assignments', {
    method: 'POST',
    cookie: manager,
    body: { complaint_id: c.complaint_id, technician_id: 1 },
    expected: 201,
  })
).data;
await call('/technician/assignments/' + job.assignment_id, { cookie: tech });
await call('/manager/complaints/' + c.complaint_id, { cookie: manager });
for (const action of ['accept', 'start', 'hold', 'start'])
  await call('/api/assignments/' + job.assignment_id, {
    method: 'PATCH',
    cookie: tech,
    body: { action },
  });
await call('/api/work-logs', {
  method: 'POST',
  cookie: tech,
  body: {
    assignment_id: job.assignment_id,
    work_description: 'Tested the repair.',
    hours_worked: 1,
  },
  expected: 201,
});
await call('/api/materials', {
  method: 'POST',
  cookie: tech,
  body: { complaint_id: c.complaint_id, item_id: 1, quantity_used: 1 },
  expected: 201,
});
for (const path of [
  '/api/work-logs',
  '/api/materials',
  '/api/inventory',
  '/api/assignments/' + job.assignment_id,
])
  await call(path, { cookie: tech });
await call('/api/assignments/' + job.assignment_id, {
  method: 'PATCH',
  cookie: tech,
  body: { action: 'complete' },
});
await call('/api/feedback', {
  method: 'POST',
  cookie: student,
  body: { complaint_id: c.complaint_id, rating: 5, comments: 'Verified.' },
  expected: 201,
});
await call('/api/feedback', { cookie: student });
const d = (
  await call('/api/departments', {
    method: 'POST',
    cookie: admin,
    body: {
      department_name: 'Smoke department',
      department_code: 'SMOKE-' + Date.now(),
      department_type: 'ACADEMIC',
    },
    expected: 201,
  })
).data;
await call('/api/departments/' + d.department_id, {
  method: 'PATCH',
  cookie: admin,
  body: {
    department_name: 'Updated smoke department',
    department_code: d.department_code,
    department_type: 'ACADEMIC',
  },
});
await call('/api/departments/' + d.department_id, { method: 'DELETE', cookie: admin });
await call('/api/auth/logout', { method: 'POST', cookie: student });
await call('/api/complaints', { cookie: student, expected: 401 });
console.log(
  `PASS: ${count} HTTP checks, all five roles, complete workflow, permissions and admin CRUD.`,
);
