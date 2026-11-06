import type { Entity, EntityMap, User } from '@/types/models';
import type { Repositories, Repository, NewRow } from '@/repositories/interfaces/Repository';
import { primaryKeys } from '@/repositories/interfaces/Repository';
import { adminSchemas } from '@/lib/validation';
import { allow } from '@/lib/permissions';
import { check } from '@/lib/errors';
export type AdminEntity = keyof typeof adminSchemas;
export class AdminService {
  constructor(public r: Repositories) {}
  async list(user: User, key: AdminEntity) {
    allow(user, ['ADMIN']);
    return this.r[key].findAll();
  }
  async save(user: User, key: AdminEntity, input: unknown, id?: number) {
    allow(user, ['ADMIN']);
    const data = adminSchemas[key].parse(input) as Record<string, unknown>;
    if (id) check(await this.r[key].findById(id), 'Record not found', 404);
    const all = (await this.r[key].findAll()) as unknown as Record<string, unknown>[];
    for (const field of ['email', 'department_code', 'building_code', 'category_name', 'team_name'])
      if (data[field])
        check(
          !all.some(
            (r) =>
              r[primaryKeys[key]] !== id &&
              String(r[field]).toLowerCase() === String(data[field]).toLowerCase(),
          ),
          `${field} must be unique`,
          409,
        );
    if (key === 'users') {
      check(await this.r.departments.findById(Number(data.department_id)), 'Unknown department');
      if (id === user.user_id)
        check(
          data.role === 'ADMIN' && data.status === 'ACTIVE',
          'You cannot disable or demote your current admin account',
          409,
        );
      if (id) {
        const t = (await this.r.technicians.findAll()).find((t) => t.user_id === id);
        if (t)
          check(data.role === 'TECHNICIAN', 'Technician profiles require technician users', 409);
        const teams = (await this.r.teams.findAll()).filter((t) => t.manager_id === id);
        if (teams.length)
          check(
            ['ADMIN', 'MAINTENANCE_MANAGER'].includes(String(data.role)),
            'A team manager must retain a management role',
            409,
          );
      }
    }
    if (key === 'rooms') {
      const b = await this.r.buildings.findById(Number(data.building_id));
      check(b, 'Unknown building');
      check(Number(data.floor_number) <= b.number_of_floors, 'Floor exceeds building height');
      check(
        !all.some(
          (r) =>
            r.room_id !== id &&
            r.building_id === data.building_id &&
            r.room_number === data.room_number,
        ),
        'Room number must be unique within a building',
        409,
      );
      if (id)
        check(
          !(await this.r.complaints.findAll()).some(
            (c) => c.room_id === id && c.building_id !== data.building_id,
          ),
          'Cannot move a room referenced by existing complaints',
          409,
        );
    }
    if (key === 'buildings' && id)
      check(
        !(await this.r.rooms.findAll()).some(
          (r) => r.building_id === id && r.floor_number > Number(data.number_of_floors),
        ),
        'Existing rooms exceed the proposed floor count',
        409,
      );
    if (key === 'teams') {
      const u = await this.r.users.findById(Number(data.manager_id));
      check(
        u && ['MAINTENANCE_MANAGER', 'ADMIN'].includes(u.role) && u.status === 'ACTIVE',
        'Choose an active manager or admin',
      );
    }
    const repo = this.r[key] as Repository<AdminEntity>;
    return id
      ? repo.update(id, data as Partial<EntityMap[AdminEntity]>)
      : repo.create(data as NewRow<AdminEntity>);
  }
  async remove(user: User, key: AdminEntity, id: number) {
    allow(user, ['ADMIN']);
    check(await this.r[key].findById(id), 'Record not found', 404);
    check(!(key === 'users' && id === user.user_id), 'Cannot delete your active account', 409);
    const refs: Partial<Record<AdminEntity, [Entity, string][]>> = {
      departments: [['users', 'department_id']],
      users: [
        ['complaints', 'reported_by'],
        ['history', 'changed_by'],
        ['teams', 'manager_id'],
        ['technicians', 'user_id'],
        ['assignments', 'assigned_by'],
        ['feedback', 'user_id'],
      ],
      buildings: [
        ['rooms', 'building_id'],
        ['complaints', 'building_id'],
      ],
      rooms: [['complaints', 'room_id']],
      categories: [['complaints', 'category_id']],
      teams: [['technicians', 'team_id']],
    };
    for (const [entity, field] of refs[key] ?? [])
      check(
        !(await this.r[entity].findAll()).some(
          (row) => (row as unknown as Record<string, unknown>)[field] === id,
        ),
        'Record is referenced; update or remove dependent records first',
        409,
      );
    return this.r[key].remove(id);
  }
}
