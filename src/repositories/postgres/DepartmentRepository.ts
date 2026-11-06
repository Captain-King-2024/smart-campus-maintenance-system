import { PostgresRepository } from './PostgresRepository';
export class DepartmentRepository extends PostgresRepository<'departments'> {
  constructor() {
    super('departments');
  }
}
