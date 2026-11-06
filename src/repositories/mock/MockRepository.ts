import { seed, type Store } from '@/data/mock/seed';
import type { Entity, EntityMap } from '@/types/models';
import {
  primaryKeys,
  type Repository,
  type Repositories,
  type NewRow,
} from '../interfaces/Repository';
import type { ComplaintRepository } from '../interfaces/ComplaintRepository';
import { check } from '@/lib/errors';
export class MockRepository<K extends Entity> implements Repository<K> {
  constructor(
    protected store: Store,
    protected entity: K,
  ) {}
  async findAll(): Promise<EntityMap[K][]> {
    return structuredClone(this.store[this.entity]);
  }
  async findById(id: number): Promise<EntityMap[K] | null> {
    return structuredClone(
      this.store[this.entity].find(
        (row) => Number(row[primaryKeys[this.entity] as unknown as keyof typeof row]) === id,
      ) ?? null,
    );
  }
  async create(data: NewRow<K>): Promise<EntityMap[K]> {
    // DATABASE TODO: replace generated mock IDs and array writes with database persistence.
    const key = primaryKeys[this.entity];
    const rows = this.store[this.entity];
    const id =
      Math.max(0, ...rows.map((row) => Number(row[key as unknown as keyof typeof row]))) + 1;
    const row = { ...data, [key]: id } as unknown as EntityMap[K];
    rows.push(row);
    return structuredClone(row);
  }
  async update(id: number, data: Partial<EntityMap[K]>): Promise<EntityMap[K]> {
    const key = primaryKeys[this.entity];
    const rows = this.store[this.entity];
    const index = rows.findIndex((row) => Number(row[key as unknown as keyof typeof row]) === id);
    check(index >= 0, 'Record not found', 404);
    rows[index] = { ...rows[index], ...data, [key]: id };
    return structuredClone(rows[index]);
  }
  async remove(id: number): Promise<void> {
    const key = primaryKeys[this.entity];
    const rows = this.store[this.entity];
    const index = rows.findIndex((row) => Number(row[key as unknown as keyof typeof row]) === id);
    check(index >= 0, 'Record not found', 404);
    rows.splice(index, 1);
  }
}
export class MockComplaintRepository
  extends MockRepository<'complaints'>
  implements ComplaintRepository
{
  constructor(store: Store) {
    super(store, 'complaints');
  }
  async findByUser(userId: number) {
    return (await this.findAll()).filter((c) => c.reported_by === userId);
  }
  async updateStatus(id: number, status: EntityMap['complaints']['status']) {
    return this.update(id, { status });
  }
}
export function makeRepositories(store: Store): Repositories {
  return Object.fromEntries(
    (Object.keys(primaryKeys) as Entity[]).map((k) => [
      k,
      k === 'complaints' ? new MockComplaintRepository(store) : new MockRepository(store, k),
    ]),
  ) as unknown as Repositories;
}
// One Node process, not a database. Reload/restart clears data. Never use with multiple workers.
const globalStore = globalThis as unknown as { campusStore?: Store };
export const store = (globalStore.campusStore ??= seed());
