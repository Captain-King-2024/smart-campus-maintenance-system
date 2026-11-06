import { PostgresRepository } from './PostgresRepository';
export class AssignmentRepository extends PostgresRepository<'assignments'> {
  constructor() {
    super('assignments');
  }
}
