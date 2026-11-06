import { PostgresRepository } from './PostgresRepository';
export class WorkLogRepository extends PostgresRepository<'work-logs'> {
  constructor() {
    super('work-logs');
  }
}
