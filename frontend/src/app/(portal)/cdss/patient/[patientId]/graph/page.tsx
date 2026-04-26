import React from 'react';
import KnowledgeGraphExplorer from '@/components/cdss/KnowledgeGraphExplorer';

export default async function KnowledgeGraphPage({ 
  params 
}: { 
  params: Promise<{ patientId: string }>
}) {
  const resolvedParams = await params;
  
  return (
    <div className="flex h-full min-h-screen flex-col gap-2 p-3 lg:p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Medical Knowledge Graph
          </h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Patient-centered graph from Neo4j.
          </p>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <KnowledgeGraphExplorer patientId={resolvedParams.patientId} />
      </div>
    </div>
  );
}
