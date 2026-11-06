import type { User } from '@/types/models';
import type { Repositories } from '@/repositories/interfaces/Repository';
import { allow, workers } from '@/lib/permissions';
export class TechnicianService {
  constructor(public r: Repositories) {}
  async list(user: User) {
    allow(user, workers);
    return this.r.technicians.findAll();
  }
}
