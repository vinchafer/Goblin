import { redirect } from 'next/navigation';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ProjectDetailRedirect({ params }: Props) {
  const { id } = await params;
  redirect(`/dashboard/project/${id}`);
}
