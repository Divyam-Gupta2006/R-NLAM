'use client';

import { ProjectDetailView } from '@/views/ProjectDetailView';

export default function ProjectPage({ params }: { params: { id: string } }) {
  return <ProjectDetailView id={params.id} />;
}
