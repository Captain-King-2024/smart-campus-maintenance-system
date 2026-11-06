import { PostgresRepository } from './PostgresRepository';
export class MaterialRepository extends PostgresRepository<'materials'> {
  constructor() {
    super('materials');
  }
}
