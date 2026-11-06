import { PostgresRepository } from './PostgresRepository';
export class UserRepository extends PostgresRepository<'users'> {
  constructor() {
    super('users');
  }
}
