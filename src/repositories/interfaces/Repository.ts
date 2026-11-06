import type { Entity, EntityMap } from '@/types/models';
export const primaryKeys = {
  departments: 'department_id',
  users: 'user_id',
  buildings: 'building_id',
  rooms: 'room_id',
  categories: 'category_id',
  complaints: 'complaint_id',
  history: 'history_id',
  teams: 'team_id',
  technicians: 'technician_id',
  assignments: 'assignment_id',
  'work-logs': 'work_log_id',
  inventory: 'item_id',
  materials: 'complaint_material_id',
  feedback: 'feedback_id',
} as const;
export type NewRow<K extends Entity> = Omit<EntityMap[K], (typeof primaryKeys)[K]>;
/** Shared contract implemented by mock and PostgreSQL providers. */
export interface Repository<K extends Entity> {
  findAll(): Promise<EntityMap[K][]>;
  findById(id: number): Promise<EntityMap[K] | null>;
  create(data: NewRow<K>): Promise<EntityMap[K]>;
  update(id: number, data: Partial<EntityMap[K]>): Promise<EntityMap[K]>;
  remove(id: number): Promise<void>;
}
export type Repositories = { [K in Entity]: Repository<K> } & { databaseManagedEffects?: boolean };
