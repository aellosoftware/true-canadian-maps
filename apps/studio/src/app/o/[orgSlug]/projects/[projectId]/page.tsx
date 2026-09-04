import { redirect } from "next/navigation";
export default async function ProjectIndex({ params }: { params: Promise<{ orgSlug: string; projectId: string }> }) {
  const { orgSlug, projectId } = await params;
  redirect(`/o/${orgSlug}/projects/${projectId}/style`);
}
