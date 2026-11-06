import { PostgresRepository } from './PostgresRepository';
export class StatusHistoryRepository extends PostgresRepository<'history'> {
  constructor() {
    super('history');
  }
}
