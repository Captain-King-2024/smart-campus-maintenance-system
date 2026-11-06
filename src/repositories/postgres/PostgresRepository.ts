import type { Entity, EntityMap } from '@/types/models';
import { primaryKeys, type Repository, type NewRow } from '../interfaces/Repository';
import { connection, inTransaction } from '@/lib/database';
import { check } from '@/lib/errors';

// Identifiers come only from this fixed allowlist; all values are bound parameters.
const metadata = {
  departments: {
    table: 'departments',
    columns: ['department_id', 'department_name', 'department_code', 'department_type'],
  },
  users: {
    table: 'users',
    columns: ['user_id', 'department_id', 'email', 'name', 'role', 'status'],
  },
  buildings: {
    table: 'buildings',
    columns: ['building_id', 'building_name', 'building_code', 'building_type', 'number_of_floors'],
  },
  rooms: {
    table: 'rooms',
    columns: ['room_id', 'building_id', 'room_number', 'floor_number', 'room_type'],
  },
  categories: {
    table: 'complaint_categories',
    columns: ['category_id', 'category_name', 'default_priority', 'expected_resolution_hours'],
  },
  complaints: {
    table: 'complaints',
    columns: [
      'complaint_id',
      'reported_by',
      'category_id',
      'building_id',
      'room_id',
      'title',
      'description',
      'priority',
      'status',
      'reported_at',
      'expected_resolution_at',
      'resolved_at',
    ],
  },
  history: {
    table: 'complaint_status_history',
    columns: ['history_id', 'complaint_id', 'changed_by', 'old_status', 'new_status', 'changed_at'],
  },
  teams: {
    table: 'maintenance_teams',
    columns: ['team_id', 'manager_id', 'team_name', 'specialization', 'status'],
  },
  technicians: {
    table: 'technicians',
    columns: [
      'technician_id',
      'user_id',
      'team_id',
      'employee_code',
      'specialization',
      'availability_status',
      'experience_years',
    ],
  },
  assignments: {
    table: 'complaint_assignments',
    columns: [
      'assignment_id',
      'complaint_id',
      'technician_id',
      'assigned_by',
      'assigned_at',
      'started_at',
      'completed_at',
      'assignment_status',
    ],
  },
  'work-logs': {
    table: 'work_logs',
    columns: [
      'work_log_id',
      'assignment_id',
      'technician_id',
      'work_description',
      'work_date',
      'hours_worked',
    ],
  },
  inventory: {
    table: 'inventory_items',
    columns: ['item_id', 'item_code', 'item_name', 'quantity_available', 'unit_cost'],
  },
  materials: {
    table: 'complaint_materials',
    columns: [
      'complaint_material_id',
      'complaint_id',
      'item_id',
      'technician_id',
      'quantity_used',
      'unit_cost',
      'total_cost',
    ],
  },
  feedback: {
    table: 'feedback',
    columns: [
      'feedback_id',
      'complaint_id',
      'user_id',
      'technician_id',
      'rating',
      'comments',
      'submitted_at',
    ],
  },
} as const;
export class PostgresRepository<K extends Entity> implements Repository<K> {
  constructor(public key: K) {}
  private get table() {
    return metadata[this.key].table;
  }
  private get pk() {
    return primaryKeys[this.key];
  }
  async findAll(): Promise<EntityMap[K][]> {
    return (await connection().query(`SELECT * FROM ${this.table} ORDER BY ${this.pk}`)).rows;
  }
  async findById(id: number): Promise<EntityMap[K] | null> {
    return (
      (await connection().query(`SELECT * FROM ${this.table} WHERE ${this.pk} = $1`, [id]))
        .rows[0] ?? null
    );
  }
  private fields(data: object) {
    return Object.entries(data).filter(
      ([key, value]) =>
        value !== undefined &&
        key !== this.pk &&
        !(this.key === 'materials' && key === 'total_cost') &&
        (metadata[this.key].columns as readonly string[]).includes(key),
    );
  }
  async create(data: NewRow<K>): Promise<EntityMap[K]> {
    check(inTransaction(), 'Database writes require a transaction', 500);
    const fields = this.fields(data);
    check(fields.length, 'No writable fields');
    const sql = `INSERT INTO ${this.table} (${fields.map(([key]) => key).join(', ')}) VALUES (${fields.map((_, i) => '$' + (i + 1)).join(', ')}) RETURNING *`;
    return (
      await connection().query(
        sql,
        fields.map(([, value]) => value),
      )
    ).rows[0];
  }
  async update(id: number, data: Partial<EntityMap[K]>): Promise<EntityMap[K]> {
    check(inTransaction(), 'Database writes require a transaction', 500);
    const fields = this.fields(data);
    check(fields.length, 'No writable fields');
    const result = await connection().query(
      `UPDATE ${this.table} SET ${fields.map(([key], i) => `${key} = $${i + 1}`).join(', ')} WHERE ${this.pk} = $${fields.length + 1} RETURNING *`,
      [...fields.map(([, value]) => value), id],
    );
    check(result.rows[0], 'Record not found', 404);
    return result.rows[0];
  }
  async remove(id: number): Promise<void> {
    check(inTransaction(), 'Database writes require a transaction', 500);
    const result = await connection().query(`DELETE FROM ${this.table} WHERE ${this.pk} = $1`, [
      id,
    ]);
    check(result.rowCount, 'Record not found', 404);
  }
}
