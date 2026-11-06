import { PostgresRepository } from './PostgresRepository';
export class TeamRepository extends PostgresRepository<'teams'> {
  constructor() {
    super('teams');
  }
}
