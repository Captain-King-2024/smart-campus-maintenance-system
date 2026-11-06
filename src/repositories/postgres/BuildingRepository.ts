import { PostgresRepository } from './PostgresRepository';
export class BuildingRepository extends PostgresRepository<'buildings'> {
  constructor() {
    super('buildings');
  }
}
