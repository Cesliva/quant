import ProjectDashboardClient from "@/components/projects/ProjectDashboardClient";
import DashboardShell from "@/components/layout/DashboardShell";

interface ProjectPageProps {
  params: { id: string };
}

export default function ProjectPage({ params }: ProjectPageProps) {
  return (
    <DashboardShell>
      <ProjectDashboardClient projectId={params.id} />
    </DashboardShell>
  );
}




