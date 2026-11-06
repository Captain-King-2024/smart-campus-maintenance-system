import { PostgresRepository } from './PostgresRepository';
export class RoomRepository extends PostgresRepository<'rooms'> {
  constructor() {
    super('rooms');
  }
}
