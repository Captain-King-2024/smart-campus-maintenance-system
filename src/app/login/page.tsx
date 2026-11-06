import { Login } from '@/components/Login';
import { repositories, dataProvider } from '@/repositories';
import { roles } from '@/types/models';
export const dynamic = 'force-dynamic';
const labels = ['Student', 'Faculty', 'Technician', 'Maintenance Manager', 'Admin'];
export default async function Page() {
  const users = await repositories.users.findAll();
  const demos = roles.flatMap((role, i) => {
    const user = users.find((u) => u.role === role && u.status === 'ACTIVE');
    return user
      ? [
          {
            id: user.user_id,
            name: user.name,
            role: labels[i],
            description: 'Open your workspace',
            icon: labels[i][0],
          },
        ]
      : [];
  });
  return <Login demos={demos} persistent={dataProvider === 'postgres'} />;
}
