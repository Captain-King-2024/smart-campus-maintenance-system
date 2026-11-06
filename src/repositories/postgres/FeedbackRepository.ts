import { PostgresRepository } from './PostgresRepository';
export class FeedbackRepository extends PostgresRepository<'feedback'> {
  constructor() {
    super('feedback');
  }
}
