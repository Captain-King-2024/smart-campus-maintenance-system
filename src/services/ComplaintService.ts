import type { Complaint, User, ComplaintStatus } from '@/types/models';
import type { Repositories } from '@/repositories/interfaces/Repository';
import { complaintInput, complaintPatch } from '@/lib/validation';
import { allow, managers } from '@/lib/permissions';
import { check } from '@/lib/errors';
export class ComplaintService {
  constructor(public r: Repositories) {}
  async visible(user: User, c: Complaint) {
    if (managers.includes(user.role)) return true;
    if (user.role === 'TECHNICIAN') {
      const t = (await this.r.technicians.findAll()).find((t) => t.user_id === user.user_id);
      return (await this.r.assignments.findAll()).some(
        (a) =>
          a.complaint_id === c.complaint_id &&
          a.technician_id === t?.technician_id &&
          a.assignment_status !== 'CANCELLED',
      );
    }
    return c.reported_by === user.user_id;
  }
  async list(user: User, query: URLSearchParams = new URLSearchParams()) {
    const all = await this.r.complaints.findAll();
    const rows: Complaint[] = [];
    for (const c of all) if (await this.visible(user, c)) rows.push(c);
    const assignments = await this.r.assignments.findAll();
    return rows
      .filter((c) =>
        ['status', 'priority', 'category_id', 'building_id'].every(
          (k) => !query.get(k) || String(c[k as keyof Complaint]) === query.get(k),
        ),
      )
      .filter(
        (c) =>
          !query.get('technician_id') ||
          assignments.some(
            (a) =>
              a.complaint_id === c.complaint_id &&
              a.technician_id === Number(query.get('technician_id')) &&
              a.assignment_status !== 'CANCELLED',
          ),
      )
      .filter(
        (c) =>
          !query.get('search') ||
          `${c.title} ${c.complaint_id} ${c.description}`
            .toLowerCase()
            .includes(query.get('search')!.toLowerCase()),
      )
      .sort((a, b) => b.reported_at.localeCompare(a.reported_at));
  }
  async get(user: User, id: number) {
    const c = await this.r.complaints.findById(id);
    check(c, 'Complaint not found', 404);
    check(await this.visible(user, c), 'Complaint access denied', 403);
    return c;
  }
  async createComplaint(user: User, input: unknown) {
    allow(user, ['STUDENT', 'FACULTY']);
    const data = complaintInput.parse(input);
    const category = await this.r.categories.findById(data.category_id);
    check(category, 'Unknown category');
    check(await this.r.buildings.findById(data.building_id), 'Unknown building');
    if (data.room_id) {
      const room = await this.r.rooms.findById(data.room_id);
      check(
        room && room.building_id === data.building_id,
        'Room must belong to the selected building',
      );
    }
    const now = new Date();
    const c = await this.r.complaints.create({
      ...data,
      room_id: data.room_id ?? null,
      reported_by: user.user_id,
      status: 'SUBMITTED',
      reported_at: now.toISOString(),
      expected_resolution_at: new Date(
        +now + category.expected_resolution_hours * 3600000,
      ).toISOString(),
      resolved_at: null,
    });
    await this.r.history.create({
      complaint_id: c.complaint_id,
      changed_by: user.user_id,
      old_status: null,
      new_status: 'SUBMITTED',
      changed_at: now.toISOString(),
    });
    return c;
  }
  async transition(user: User, c: Complaint, status: ComplaintStatus) {
    await this.r.history.create({
      complaint_id: c.complaint_id,
      changed_by: user.user_id,
      old_status: c.status,
      new_status: status,
      changed_at: new Date().toISOString(),
    });
    return this.r.complaints.update(c.complaint_id, {
      status,
      ...(status === 'RESOLVED' ? { resolved_at: new Date().toISOString() } : {}),
    });
  }
  async patch(user: User, id: number, input: unknown) {
    allow(user, managers);
    const data = complaintPatch.parse(input);
    const c = await this.get(user, id);
    if (data.status) {
      const transitions: Partial<Record<ComplaintStatus, ComplaintStatus[]>> = {
        SUBMITTED: ['UNDER_REVIEW', 'REJECTED'],
        UNDER_REVIEW: ['REJECTED'],
        RESOLVED: ['CLOSED'],
      };
      check(
        transitions[c.status]?.includes(data.status),
        'Invalid status transition. Assignments control technician work states.',
        409,
      );
      await this.transition(user, c, data.status);
    }
    if (data.priority) await this.r.complaints.update(id, { priority: data.priority });
    return this.get(user, id);
  }
  async detail(user: User, id: number) {
    const complaint = await this.get(user, id);
    const assignments = (await this.r.assignments.findAll()).filter((a) => a.complaint_id === id);
    const ids = assignments.map((a) => a.assignment_id);
    const materials = (await this.r.materials.findAll()).filter((m) => m.complaint_id === id);
    return {
      complaint,
      assignments,
      history: (await this.r.history.findAll())
        .filter((h) => h.complaint_id === id)
        .sort((a, b) => a.changed_at.localeCompare(b.changed_at)),
      workLogs: (await this.r['work-logs'].findAll()).filter((l) => ids.includes(l.assignment_id)),
      materials,
      materialItems: (await this.r.inventory.findAll())
        .filter((item) => materials.some((m) => m.item_id === item.item_id))
        .map((item) => ({ item_id: item.item_id, item_name: item.item_name })),
      feedback: (await this.r.feedback.findAll()).find((f) => f.complaint_id === id) ?? null,
    };
  }
}
