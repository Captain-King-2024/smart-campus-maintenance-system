import type { User, ComplaintAssignment } from '@/types/models';
import type { Repositories } from '@/repositories/interfaces/Repository';
import { allow, managers } from '@/lib/permissions';
import { check } from '@/lib/errors';
import { assignmentInput, assignmentPatch, workLogInput } from '@/lib/validation';
import { ComplaintService } from './ComplaintService';
export class AssignmentService {
  constructor(
    public r: Repositories,
    public complaints: ComplaintService,
  ) {}
  async list(user: User) {
    allow(user, ['ADMIN', 'MAINTENANCE_MANAGER', 'TECHNICIAN']);
    const t = (await this.r.technicians.findAll()).find((t) => t.user_id === user.user_id);
    return (await this.r.assignments.findAll()).filter(
      (a) => user.role !== 'TECHNICIAN' || a.technician_id === t?.technician_id,
    );
  }
  async own(user: User, id: number) {
    allow(user, ['TECHNICIAN']);
    const a = await this.r.assignments.findById(id);
    check(a, 'Assignment not found', 404);
    const t = await this.r.technicians.findById(a.technician_id);
    check(t?.user_id === user.user_id, 'Assignment belongs to another technician', 403);
    return a;
  }
  async refreshAvailability(technician_id: number) {
    const t = await this.r.technicians.findById(technician_id);
    if (t?.availability_status === 'OFF_DUTY') return;
    const active = (await this.r.assignments.findAll()).some(
      (a) =>
        a.technician_id === technician_id &&
        !['CANCELLED', 'COMPLETED'].includes(a.assignment_status),
    );
    await this.r.technicians.update(technician_id, {
      availability_status: active ? 'BUSY' : 'AVAILABLE',
    });
  }
  async assignTechnician(user: User, input: unknown) {
    allow(user, managers);
    const data = assignmentInput.parse(input);
    const c = await this.complaints.get(user, data.complaint_id);
    check(
      !['RESOLVED', 'CLOSED', 'REJECTED'].includes(c.status),
      'Cannot assign a terminal complaint',
      409,
    );
    const t = await this.r.technicians.findById(data.technician_id);
    check(t, 'Unknown technician');
    check(t.availability_status !== 'OFF_DUTY', 'Technician is off duty', 409);
    const tu = await this.r.users.findById(t.user_id);
    const team = await this.r.teams.findById(t.team_id);
    check(
      tu?.status === 'ACTIVE' && team?.status === 'ACTIVE',
      'Technician or team is inactive',
      409,
    );
    const previous = (await this.r.assignments.findAll()).filter(
      (a) =>
        a.complaint_id === c.complaint_id &&
        !['COMPLETED', 'CANCELLED'].includes(a.assignment_status),
    );
    check(
      !previous.some((a) => a.technician_id === t.technician_id),
      'Technician is already assigned',
      409,
    );
    for (const a of previous) {
      await this.r.assignments.update(a.assignment_id, { assignment_status: 'CANCELLED' });
      await this.refreshAvailability(a.technician_id);
    }
    const a = await this.r.assignments.create({
      ...data,
      assigned_by: user.user_id,
      assigned_at: new Date().toISOString(),
      started_at: null,
      completed_at: null,
      assignment_status: 'ASSIGNED',
    });
    await this.refreshAvailability(t.technician_id);
    await this.complaints.transition(user, c, 'ASSIGNED');
    return a;
  }
  async acceptAssignment(user: User, a: ComplaintAssignment) {
    check(a.assignment_status === 'ASSIGNED', 'Only new assignments can be accepted', 409);
    return this.r.assignments.update(a.assignment_id, { assignment_status: 'ACCEPTED' });
  }
  async startAssignment(user: User, a: ComplaintAssignment) {
    check(
      ['ACCEPTED', 'ON_HOLD'].includes(a.assignment_status),
      'Accept the assignment first, or resume held work',
      409,
    );
    const c = await this.complaints.get(user, a.complaint_id);
    await this.complaints.transition(user, c, 'IN_PROGRESS');
    return this.r.assignments.update(a.assignment_id, {
      assignment_status: 'IN_PROGRESS',
      started_at: a.started_at ?? new Date().toISOString(),
    });
  }
  async completeAssignment(user: User, a: ComplaintAssignment) {
    check(a.assignment_status === 'IN_PROGRESS', 'Only active work can be completed', 409);
    check(
      (await this.r['work-logs'].findAll()).some((l) => l.assignment_id === a.assignment_id),
      'Add a work log before completing',
      409,
    );
    const c = await this.complaints.get(user, a.complaint_id);
    await this.complaints.transition(user, c, 'RESOLVED');
    const out = await this.r.assignments.update(a.assignment_id, {
      assignment_status: 'COMPLETED',
      completed_at: new Date().toISOString(),
    });
    await this.refreshAvailability(a.technician_id);
    return out;
  }
  async patch(user: User, id: number, input: unknown) {
    const { action } = assignmentPatch.parse(input);
    const a = await this.own(user, id);
    if (action === 'accept') return this.acceptAssignment(user, a);
    if (action === 'start') return this.startAssignment(user, a);
    if (action === 'complete') return this.completeAssignment(user, a);
    check(a.assignment_status === 'IN_PROGRESS', 'Only active work can be held', 409);
    const c = await this.complaints.get(user, a.complaint_id);
    await this.complaints.transition(user, c, 'ON_HOLD');
    return this.r.assignments.update(id, { assignment_status: 'ON_HOLD' });
  }
  async addWorkLog(user: User, input: unknown) {
    const data = workLogInput.parse(input);
    const a = await this.own(user, data.assignment_id);
    check(a.assignment_status === 'IN_PROGRESS', 'Start work before adding logs', 409);
    return this.r['work-logs'].create({
      ...data,
      technician_id: a.technician_id,
      work_date: new Date().toISOString(),
    });
  }
}
