import { PostgresRepository } from './PostgresRepository';
export class TechnicianRepository extends PostgresRepository<'technicians'> {
  constructor() {
    super('technicians');
  }
}
