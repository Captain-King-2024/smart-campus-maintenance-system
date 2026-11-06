import type { Complaint, ComplaintStatus } from '@/types/models';
import type { Repository } from './Repository';
export interface ComplaintRepository extends Repository<'complaints'> {
  findByUser(userId: number): Promise<Complaint[]>;
  updateStatus(id: number, status: ComplaintStatus): Promise<Complaint>;
}
