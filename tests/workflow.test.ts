import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seed } from '../src/data/mock/seed';
import { makeRepositories } from '../src/repositories/mock/MockRepository';
import { ComplaintService } from '../src/services/ComplaintService';
import { AssignmentService } from '../src/services/AssignmentService';
import { InventoryService } from '../src/services/InventoryService';
import { FeedbackService } from '../src/services/FeedbackService';
import { AdminService } from '../src/services/AdminService';
import { serialize } from '../src/lib/mutation-lock';
function setup() {
  const data = seed();
  const r = makeRepositories(data);
  const c = new ComplaintService(r);
  const a = new AssignmentService(r, c);
  return {
    data,
    r,
    c,
    a,
    i: new InventoryService(r),
    f: new FeedbackService(r),
    admin: new AdminService(r),
    student: data.users[0],
    faculty: data.users[1],
    tech: data.users[2],
    manager: data.users[3],
    root: data.users[4],
    otherTech: data.users[5],
  };
}
const input = {
  title: 'Socket sparks in classroom',
  description: 'Please inspect the faulty socket beside the desk.',
  category_id: 1,
  building_id: 1,
  room_id: 1,
  priority: 'HIGH' as const,
};
test('all 14 entities are seeded; generated IDs preserve foreign IDs', async () => {
  const s = setup();
  assert.equal(Object.keys(s.data).length, 14);
  const c = await s.c.createComplaint(s.student, input);
  assert.equal(c.reported_by, 1);
  assert.equal(c.room_id, 1);
  assert.equal(c.complaint_id, 13);
});
test('reporter visibility and backend role permissions', async () => {
  const s = setup();
  const c = await s.c.createComplaint(s.student, input);
  await assert.rejects(() => s.c.get(s.faculty, c.complaint_id), /access denied/);
  await assert.rejects(() => s.c.createComplaint(s.tech, input), /permission/);
  assert((await s.c.list(s.student)).every((c) => c.reported_by === 1));
});
test('invalid input and mismatched room rejected without writes', async () => {
  const s = setup();
  await assert.rejects(() => s.c.createComplaint(s.student, { ...input, title: '  ' }));
  await assert.rejects(
    () => s.c.createComplaint(s.student, { ...input, room_id: 4 }),
    /Room must belong/,
  );
  assert.equal(s.data.complaints.length, 12);
});
test('full workflow: submit, review, assign, accept, start, hold, resume, log, material, resolve, feedback, close', async () => {
  const s = setup();
  const c = await s.c.createComplaint(s.student, input);
  await s.c.patch(s.manager, c.complaint_id, { status: 'UNDER_REVIEW' });
  const a = await s.a.assignTechnician(s.manager, {
    complaint_id: c.complaint_id,
    technician_id: 1,
  });
  await assert.rejects(() => s.a.patch(s.tech, a.assignment_id, { action: 'start' }), /Accept/);
  await s.a.patch(s.tech, a.assignment_id, { action: 'accept' });
  await s.a.patch(s.tech, a.assignment_id, { action: 'start' });
  await s.a.patch(s.tech, a.assignment_id, { action: 'hold' });
  await assert.rejects(
    () =>
      s.a.addWorkLog(s.tech, {
        assignment_id: a.assignment_id,
        work_description: 'test',
        hours_worked: 1,
      }),
    /Start work/,
  );
  await s.a.patch(s.tech, a.assignment_id, { action: 'start' });
  await assert.rejects(
    () => s.a.patch(s.tech, a.assignment_id, { action: 'complete' }),
    /work log/,
  );
  await s.a.addWorkLog(s.tech, {
    assignment_id: a.assignment_id,
    work_description: 'Replaced socket and tested circuit.',
    hours_worked: 1.5,
  });
  const before = (await s.r.inventory.findById(1))!;
  const material = await s.i.recordMaterialUsage(s.tech, {
    complaint_id: c.complaint_id,
    item_id: 1,
    quantity_used: 2,
  });
  assert.equal(material.total_cost, before.unit_cost * 2);
  assert.equal(
    (await s.r.inventory.findById(1))!.quantity_available,
    before.quantity_available - 2,
  );
  await s.a.patch(s.tech, a.assignment_id, { action: 'complete' });
  assert.equal((await s.c.get(s.student, c.complaint_id)).status, 'RESOLVED');
  await s.f.submitFeedback(s.student, {
    complaint_id: c.complaint_id,
    rating: 5,
    comments: 'Works well!',
  });
  await assert.rejects(
    () => s.f.submitFeedback(s.student, { complaint_id: c.complaint_id, rating: 4, comments: '' }),
    /already submitted/,
  );
  await s.c.patch(s.manager, c.complaint_id, { status: 'CLOSED' });
  const detail = await s.c.detail(s.student, c.complaint_id);
  assert.equal(detail.workLogs.length, 1);
  assert.equal(detail.materials.length, 1);
  assert.equal(detail.materialItems[0].item_name, 'Electrical socket');
  assert.equal(detail.feedback?.rating, 5);
  assert(detail.history.length >= 8);
  assert(detail.complaint.resolved_at);
});
test('technician cannot mutate someone else’s assignments', async () => {
  const s = setup();
  const c = await s.c.createComplaint(s.student, input);
  const a = await s.a.assignTechnician(s.manager, {
    complaint_id: c.complaint_id,
    technician_id: 1,
  });
  await assert.rejects(
    () => s.a.patch(s.otherTech, a.assignment_id, { action: 'accept' }),
    /another technician/,
  );
});
test('reassignment cancels previous work and blocks the previous technician', async () => {
  const s = setup();
  const c = await s.c.createComplaint(s.student, input);
  const a = await s.a.assignTechnician(s.manager, {
    complaint_id: c.complaint_id,
    technician_id: 1,
  });
  await s.a.assignTechnician(s.manager, { complaint_id: c.complaint_id, technician_id: 2 });
  assert.equal((await s.r.assignments.findById(a.assignment_id))!.assignment_status, 'CANCELLED');
  await assert.rejects(() => s.a.patch(s.tech, a.assignment_id, { action: 'accept' }), /Only new/);
  await assert.rejects(() => s.c.get(s.tech, c.complaint_id), /access denied/);
});
test('stock and positive quantity checks prevent invalid usage', async () => {
  const s = setup();
  const a = s.data.assignments.find(
    (a) => a.technician_id === 2 && a.assignment_status === 'IN_PROGRESS',
  )!;
  assert(a);
  const before = s.data.inventory[0].quantity_available;
  await assert.rejects(
    () =>
      s.i.recordMaterialUsage(s.otherTech, {
        complaint_id: a.complaint_id,
        item_id: 1,
        quantity_used: before + 1,
      }),
    /Insufficient/,
  );
  await assert.rejects(() =>
    s.i.recordMaterialUsage(s.otherTech, {
      complaint_id: a.complaint_id,
      item_id: 1,
      quantity_used: -1,
    }),
  );
  assert.equal(s.data.inventory[0].quantity_available, before);
});
test('serialized concurrent stock allocation cannot overspend', async () => {
  const s = setup();
  const a = s.data.assignments.find(
    (a) => a.technician_id === 2 && a.assignment_status === 'IN_PROGRESS',
  )!;
  await s.r.inventory.update(1, { quantity_available: 1 });
  const results = await Promise.allSettled(
    [1, 2].map(() =>
      serialize(() =>
        s.i.recordMaterialUsage(s.otherTech, {
          complaint_id: a.complaint_id,
          item_id: 1,
          quantity_used: 1,
        }),
      ),
    ),
  );
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal((await s.r.inventory.findById(1))!.quantity_available, 0);
});
test('feedback needs reporter ownership, resolved work, and rating 1–5', async () => {
  const s = setup();
  await assert.rejects(
    () => s.f.submitFeedback(s.student, { complaint_id: 1, rating: 5, comments: '' }),
    /after resolution/,
  );
  await assert.rejects(
    () => s.f.submitFeedback(s.faculty, { complaint_id: 6, rating: 5, comments: '' }),
    /Only the reporter/,
  );
  await assert.rejects(() =>
    s.f.submitFeedback(s.student, { complaint_id: 6, rating: 6, comments: '' }),
  );
});
test('manager transitions cannot bypass technician workflow', async () => {
  const s = setup();
  await assert.rejects(() => s.c.patch(s.manager, 1, { status: 'RESOLVED' }), /Invalid status/);
  await s.c.patch(s.manager, 1, { status: 'REJECTED' });
  await assert.rejects(
    () => s.a.assignTechnician(s.manager, { complaint_id: 1, technician_id: 1 }),
    /terminal/,
  );
});
test('admin CRUD validates unique fields, references, ownership and role', async () => {
  const s = setup();
  await assert.rejects(
    () =>
      s.admin.save(s.student, 'departments', {
        department_name: 'Test',
        department_code: 'TEST',
        department_type: 'ACADEMIC',
      }),
    /permission/,
  );
  const d = await s.admin.save(s.root, 'departments', {
    department_name: 'Physics',
    department_code: 'PHY',
    department_type: 'ACADEMIC',
  });
  assert('department_id' in d && d.department_id !== null);
  await assert.rejects(
    () =>
      s.admin.save(s.root, 'departments', {
        department_name: 'Duplicate',
        department_code: 'PHY',
        department_type: 'ACADEMIC',
      }),
    /unique/,
  );
  await s.admin.remove(s.root, 'departments', d.department_id);
  await assert.rejects(() => s.admin.remove(s.root, 'departments', 1), /referenced/);
  await assert.rejects(() => s.admin.remove(s.root, 'users', 5), /active account/);
  await assert.rejects(
    () =>
      s.admin.save(s.root, 'rooms', {
        building_id: 1,
        room_number: '999',
        floor_number: 99,
        room_type: 'LAB',
      }),
    /exceeds/,
  );
});
test('search and filters include assigned technician relationship', async () => {
  const s = setup();
  const rows = await s.c.list(
    s.manager,
    new URLSearchParams({ priority: 'CRITICAL', search: 'socket' }),
  );
  assert.equal(rows.length, 1);
  const assigned = await s.c.list(s.manager, new URLSearchParams({ technician_id: '1' }));
  assert(assigned.length > 0);
  assert(
    assigned.every((c) =>
      s.data.assignments.some((a) => a.complaint_id === c.complaint_id && a.technician_id === 1),
    ),
  );
});
