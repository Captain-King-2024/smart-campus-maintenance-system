import type { Complaint, ComplaintStatus } from '@/types/models';
import type { ComplaintRepository as Contract } from '../interfaces/ComplaintRepository';
import { connection } from '@/lib/database';
import { PostgresRepository } from './PostgresRepository';
export class ComplaintRepository extends PostgresRepository<'complaints'> implements Contract {
  constructor() {
    super('complaints');
  }
  async findByUser(userId: number): Promise<Complaint[]> {
    return (
      await connection().query(
        'SELECT * FROM complaints WHERE reported_by = $1 ORDER BY reported_at DESC',
        [userId],
      )
    ).rows;
  }
  async updateStatus(id: number, status: ComplaintStatus): Promise<Complaint> {
    return this.update(id, { status });
  }
}
