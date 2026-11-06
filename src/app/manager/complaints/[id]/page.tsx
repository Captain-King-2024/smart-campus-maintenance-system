import { ProtectedPage } from '@/components/ProtectedPage';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProtectedPage path={`/manager/complaints/${id}`} />;
}
