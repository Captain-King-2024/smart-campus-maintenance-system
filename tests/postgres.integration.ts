import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pool, connection, transaction } from '../src/lib/database';
import { makePostgresRepositories } from '../src/repositories/postgres';
import { ComplaintService } from '../src/services/ComplaintService';
import { AssignmentService } from '../src/services/AssignmentService';
import { InventoryService } from '../src/services/InventoryService';
import { FeedbackService } from '../src/services/FeedbackService';
import { AdminService } from '../src/services/AdminService';

// Destructive fixture reset is opt-in and restricted to an explicitly named *_test database.
const enabled = !!process.env.TEST_DATABASE_URL && process.env.CAMPUS_TEST_RESET === 'true';
test(
  'PostgreSQL integration: real schema, triggers, transactions and concurrency',
  { skip: !enabled },
  async (t) => {
    const url = new URL(process.env.TEST_DATABASE_URL!);
    assert(url.pathname.endsWith('_test'), 'Use a disposable database whose name ends in _test');
    process.env.DATABASE_URL = url.toString();
    t.after(async () => {
      await pool().end();
    });
    for (const name of ['01_schema.sql', '02_seed_data.sql', '05_app_compatibility.sql']) {
      await pool().query(await readFile(new URL('../database/' + name, import.meta.url), 'utf8'));
    }
    // The compatibility migration can safely be applied again.
    await pool().query(
      await readFile(new URL('../database/05_app_compatibility.sql', import.meta.url), 'utf8'),
    );
    const r = makePostgresRepositories();
    const c = new ComplaintService(r),
      a = new AssignmentService(r, c);
    const inventory = new InventoryService(r),
      feedback = new FeedbackService(r),
      admin = new AdminService(r);
    const student = (await r.users.findById(12))!,
      faculty = (await r.users.findById(16))!;
    const tech = (await r.users.findById(4))!,
      otherTech = (await r.users.findById(5))!;
    const manager = (await r.users.findById(2))!,
      root = (await r.users.findById(1))!;
    const input = {
      title: "Socket 'repair'; -- parameter test",
      description: 'Repair the classroom socket.',
      category_id: 1,
      building_id: 1,
      room_id: 1,
      priority: 'HIGH' as const,
    };
    const write = <T>(actor: { user_id: number }, fn: () => Promise<T>) =>
      transaction(actor.user_id, fn);
    async function activeJob() {
      const complaint = await write(student, () => c.createComplaint(student, input));
      const assignment = await write(manager, () =>
        a.assignTechnician(manager, { complaint_id: complaint.complaint_id, technician_id: 1 }),
      );
      await write(tech, () => a.patch(tech, assignment.assignment_id, { action: 'accept' }));
      await write(tech, () => a.patch(tech, assignment.assignment_id, { action: 'start' }));
      return { complaint, assignment };
    }
    await t.test('all repositories read seed data with numeric and date API types', async () => {
      for (const [key, repo] of Object.entries(r)) {
        if (key !== 'databaseManagedEffects')
          assert(Array.isArray(await (repo as typeof r.users).findAll()));
      }
      assert.equal(typeof (await r.inventory.findById(1))!.unit_cost, 'number');
      assert.equal(typeof (await r.complaints.findById(1))!.reported_at, 'string');
      assert.equal((await r.users.findById(12))!.role, 'STUDENT');
      assert.equal((await r.users.findById(1))!.role, 'ADMIN');
    });
    await t.test(
      'full workflow has one audit row per transition and one stock deduction',
      async () => {
        const complaint = await write(student, () => c.createComplaint(student, input));
        assert.equal(complaint.title, input.title);
        await assert.rejects(() => c.get(faculty, complaint.complaint_id), /access denied/);
        await write(manager, () =>
          c.patch(manager, complaint.complaint_id, { status: 'UNDER_REVIEW' }),
        );
        const job = await write(manager, () =>
          a.assignTechnician(manager, { complaint_id: complaint.complaint_id, technician_id: 1 }),
        );
        await assert.rejects(
          () => write(otherTech, () => a.patch(otherTech, job.assignment_id, { action: 'accept' })),
          /another technician/,
        );
        for (const action of ['accept', 'start', 'hold'])
          await write(tech, () => a.patch(tech, job.assignment_id, { action }));
        assert.equal((await r.complaints.findById(complaint.complaint_id))!.status, 'ON_HOLD');
        assert.equal((await r.technicians.findById(1))!.availability_status, 'BUSY');
        await write(tech, () => a.patch(tech, job.assignment_id, { action: 'start' }));
        await assert.rejects(
          () => write(tech, () => a.patch(tech, job.assignment_id, { action: 'complete' })),
          /work log/,
        );
        const log = await write(tech, () =>
          a.addWorkLog(tech, {
            assignment_id: job.assignment_id,
            work_description: 'Replaced socket',
            hours_worked: 1.5,
          }),
        );
        assert.equal(log.hours_worked, 1.5);
        assert.match(log.work_date, /^\d{4}-\d{2}-\d{2}$/);
        const before = (await r.inventory.findById(1))!;
        const material = await write(tech, () =>
          inventory.recordMaterialUsage(tech, {
            complaint_id: complaint.complaint_id,
            item_id: 1,
            quantity_used: 2,
          }),
        );
        assert.equal(material.total_cost, before.unit_cost * 2);
        assert.equal(
          (await r.inventory.findById(1))!.quantity_available,
          before.quantity_available - 2,
        );
        await write(tech, () => a.patch(tech, job.assignment_id, { action: 'complete' }));
        await write(student, () =>
          feedback.submitFeedback(student, {
            complaint_id: complaint.complaint_id,
            rating: 5,
            comments: 'Fixed',
          }),
        );
        await write(manager, () => c.patch(manager, complaint.complaint_id, { status: 'CLOSED' }));
        const detail = await c.detail(student, complaint.complaint_id);
        assert.deepEqual(
          detail.history.map((h) => h.new_status),
          [
            'SUBMITTED',
            'UNDER_REVIEW',
            'ASSIGNED',
            'IN_PROGRESS',
            'ON_HOLD',
            'IN_PROGRESS',
            'RESOLVED',
            'CLOSED',
          ],
        );
        assert.deepEqual(
          detail.history.map((h) => h.changed_by),
          [12, 2, 2, 4, 4, 4, 4, 2],
        );
        assert.equal(detail.feedback!.rating, 5);
      },
    );
    await t.test(
      'failure rolls back complaint, audit, and inventory changes together',
      async () => {
        const count = (await r.complaints.findAll()).length,
          histories = (await r.history.findAll()).length;
        const before = (await r.inventory.findById(1))!.quantity_available;
        await assert.rejects(
          () =>
            write(student, async () => {
              await c.createComplaint(student, input);
              await r.inventory.update(1, { quantity_available: before - 1 });
              throw new Error('deliberate failure');
            }),
          /deliberate failure/,
        );
        assert.equal((await r.complaints.findAll()).length, count);
        assert.equal((await r.history.findAll()).length, histories);
        assert.equal((await r.inventory.findById(1))!.quantity_available, before);
        await assert.rejects(() => r.inventory.update(1, { quantity_available: 0 }), /transaction/);
      },
    );
    await t.test(
      'concurrent stock requests cannot overspend; duplicate feedback has one winner',
      async () => {
        const { complaint, assignment } = await activeJob();
        const item = await write(root, () =>
          r.inventory.create({
            item_code: 'TEST-ONE',
            item_name: 'One item',
            quantity_available: 1,
            unit_cost: 2.5,
          }),
        );
        const uses = await Promise.allSettled(
          [1, 2].map(() =>
            write(tech, () =>
              inventory.recordMaterialUsage(tech, {
                complaint_id: complaint.complaint_id,
                item_id: item.item_id,
                quantity_used: 1,
              }),
            ),
          ),
        );
        assert.equal(uses.filter((x) => x.status === 'fulfilled').length, 1);
        assert.equal((await r.inventory.findById(item.item_id))!.quantity_available, 0);
        await write(tech, () =>
          a.addWorkLog(tech, {
            assignment_id: assignment.assignment_id,
            work_description: 'Done',
            hours_worked: 1,
          }),
        );
        await write(tech, () => a.patch(tech, assignment.assignment_id, { action: 'complete' }));
        const submissions = await Promise.allSettled(
          [1, 2].map(() =>
            write(student, () =>
              feedback.submitFeedback(student, {
                complaint_id: complaint.complaint_id,
                rating: 5,
                comments: '',
              }),
            ),
          ),
        );
        assert.equal(submissions.filter((x) => x.status === 'fulfilled').length, 1);
      },
    );
    await t.test('reassignment of active and held work blocks former technician', async () => {
      for (const hold of [false, true]) {
        const { complaint, assignment } = await activeJob();
        if (hold)
          await write(tech, () => a.patch(tech, assignment.assignment_id, { action: 'hold' }));
        await write(manager, () =>
          a.assignTechnician(manager, { complaint_id: complaint.complaint_id, technician_id: 2 }),
        );
        assert.equal(
          (await r.assignments.findById(assignment.assignment_id))!.assignment_status,
          'CANCELLED',
        );
        assert.equal((await r.complaints.findById(complaint.complaint_id))!.status, 'ASSIGNED');
        await assert.rejects(() => c.get(tech, complaint.complaint_id), /access denied/);
      }
    });
    await t.test('admin CRUD and reference protection work against PostgreSQL', async () => {
      const row = await write(root, () =>
        admin.save(root, 'departments', {
          department_name: 'Test Department',
          department_code: 'TEST',
          department_type: 'ACADEMIC',
        }),
      );
      assert('department_id' in row && row.department_id !== null);
      await write(root, () =>
        admin.save(
          root,
          'departments',
          { department_name: 'Updated', department_code: 'TEST', department_type: 'ACADEMIC' },
          row.department_id!,
        ),
      );
      await write(root, () => admin.remove(root, 'departments', row.department_id!));
      await assert.rejects(
        () => write(root, () => admin.remove(root, 'departments', 1)),
        /referenced/,
      );
      const actor = await write(
        manager,
        async () => (await connection().query('SELECT fn_current_actor() AS actor')).rows[0].actor,
      );
      assert.equal(actor, 2);
      assert.equal((await pool().query('SELECT fn_current_actor() AS actor')).rows[0].actor, null);
    });
  },
);
