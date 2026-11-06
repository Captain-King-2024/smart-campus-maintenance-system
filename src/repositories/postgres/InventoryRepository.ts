import { PostgresRepository } from './PostgresRepository';
export class InventoryRepository extends PostgresRepository<'inventory'> {
  constructor() {
    super('inventory');
  }
}
