import { auth } from '@/lib/auth';
import { canVisit, home } from '@/lib/permissions';
import { redirect } from 'next/navigation';
import { Shell } from './Shell';
import { Workspace } from './Workspace';
export async function ProtectedPage({ path }: { path: string }) {
  const user = await auth.currentUser();
  if (!user) redirect('/login');
  if (!canVisit(user, path)) redirect(home(user.role));
  return (
    <Shell user={user}>
      <Workspace user={user} path={path} />
    </Shell>
  );
}
