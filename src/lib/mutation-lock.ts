// Serializes mock mutations in one Node process so concurrent stock/feedback writes
// cannot interleave. PostgreSQL uses its own transaction-scoped advisory lock.
const state = globalThis as unknown as { campusMutationTail?: Promise<unknown> };
export async function serialize<T>(operation: () => Promise<T>): Promise<T> {
  const previous = state.campusMutationTail ?? Promise.resolve();
  const next = previous.catch(() => {}).then(operation);
  state.campusMutationTail = next.catch(() => {});
  return next;
}
