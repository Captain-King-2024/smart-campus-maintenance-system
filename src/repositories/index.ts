import { makeRepositories, store } from './mock/MockRepository';
// DATABASE TODO: this is the single composition point for student-written repositories.
if (process.env.DATA_PROVIDER && process.env.DATA_PROVIDER !== 'mock')
  throw new Error('Only mock repositories are implemented.');
export const repositories = makeRepositories(store);
