import { PostgresRepository } from './PostgresRepository';
export class CategoryRepository extends PostgresRepository<'categories'> {
  constructor() {
    super('categories');
  }
}
