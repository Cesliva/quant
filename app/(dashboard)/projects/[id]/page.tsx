import ProjectDashboardClient from "@/components/projects/ProjectDashboardClient";

interface ProjectPageProps {
  params: { id: string };
}

export default function ProjectPage({ params }: ProjectPageProps) {
  return <ProjectDashboardClient projectId={params.id} />;
}

