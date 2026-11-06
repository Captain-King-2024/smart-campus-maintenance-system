import type { User } from '@/types/models';
import type { Repositories } from '@/repositories/interfaces/Repository';
import { allow, workers } from '@/lib/permissions';
import { ComplaintService } from './ComplaintService';
import { check } from '@/lib/errors';
export class ReferenceService {
  constructor(
    public r: Repositories,
    public complaints: ComplaintService,
  ) {}
  async publicList(key: 'categories' | 'buildings' | 'rooms') {
    return this.r[key].findAll();
  }
  async buildingRooms(id: number) {
    check(await this.r.buildings.findById(id), 'Building not found', 404);
    return (await this.r.rooms.findAll()).filter((r) => r.building_id === id);
  }
  async workLogs(user: User, assignmentId?: number) {
    const visible = new Set((await this.complaints.list(user)).map((c) => c.complaint_id));
    const ids = (await this.r.assignments.findAll())
      .filter((a) => visible.has(a.complaint_id))
      .map((a) => a.assignment_id);
    return (await this.r['work-logs'].findAll()).filter(
      (l) => ids.includes(l.assignment_id) && (!assignmentId || l.assignment_id === assignmentId),
    );
  }
  async related(user: User, key: 'materials' | 'feedback', complaintId?: number) {
    const visible = new Set((await this.complaints.list(user)).map((c) => c.complaint_id));
    return (await this.r[key].findAll()).filter(
      (row) => visible.has(row.complaint_id) && (!complaintId || row.complaint_id === complaintId),
    );
  }
  async catalog(user: User) {
    return {
      categories: await this.r.categories.findAll(),
      buildings: await this.r.buildings.findAll(),
      rooms: await this.r.rooms.findAll(),
      // Only public directory names and IDs; account details stay admin-only.
      users: (await this.r.users.findAll()).map((u) => ({
        user_id: u.user_id,
        name: u.name,
        role: u.role,
      })),
      technicians: await this.r.technicians.findAll(),
      teams: await this.r.teams.findAll(),
    };
  }
  async teams(user: User) {
    allow(user, workers);
    return this.r.teams.findAll();
  }
  async dashboard(user: User) {
    const rows = await this.complaints.list(user);
    const active = rows.filter((c) => !['RESOLVED', 'CLOSED', 'REJECTED'].includes(c.status));
    const resolved = rows.filter((c) => c.resolved_at);
    const tech = (await this.r.technicians.findAll()).find((t) => t.user_id === user.user_id);
    const jobs = (await this.r.assignments.findAll()).filter(
      (a) => a.technician_id === tech?.technician_id,
    );
    const ts = await this.r.technicians.findAll();
    const inv = workers.includes(user.role) ? await this.r.inventory.findAll() : [];
    return {
      total: rows.length,
      active: active.length,
      resolved: resolved.length,
      average_resolution_hours: resolved.length
        ? Math.round(
            (resolved.reduce(
              (sum, c) => sum + (Date.parse(c.resolved_at!) - Date.parse(c.reported_at)) / 3600000,
              0,
            ) /
              resolved.length) *
              10,
          ) / 10
        : null,
      submitted: rows.filter((c) => c.status === 'SUBMITTED').length,
      unassigned: active.filter((c) => ['SUBMITTED', 'UNDER_REVIEW'].includes(c.status)).length,
      critical: active.filter((c) => c.priority === 'CRITICAL').length,
      available: ts.filter((t) => t.availability_status === 'AVAILABLE').length,
      busy: ts.filter((t) => t.availability_status === 'BUSY').length,
      lowStock: inv.filter((i) => i.quantity_available < 5),
      assigned: jobs.filter((a) => !['CANCELLED', 'COMPLETED'].includes(a.assignment_status))
        .length,
      working: jobs.filter((a) => a.assignment_status === 'IN_PROGRESS').length,
      completed: jobs.filter((a) => a.assignment_status === 'COMPLETED').length,
      recent: rows.slice(0, 6),
    };
  }
}
