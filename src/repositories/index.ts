import { makeRepositories, store } from './mock/MockRepository';
import { makePostgresRepositories } from './postgres';
import { transaction } from '@/lib/database';
import { serialize } from '@/lib/mutation-lock';
export const dataProvider = process.env.DATA_PROVIDER ?? 'mock';
if (!['mock', 'postgres'].includes(dataProvider))
  throw new Error('DATA_PROVIDER must be mock or postgres');
export const repositories =
  dataProvider === 'postgres' ? makePostgresRepositories() : makeRepositories(store);
export async function runMutation<T>(actorId: number, operation: () => Promise<T>): Promise<T> {
  return dataProvider === 'postgres' ? transaction(actorId, operation) : serialize(operation);
}
