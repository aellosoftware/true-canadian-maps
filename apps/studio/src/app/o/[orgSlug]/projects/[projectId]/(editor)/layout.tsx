import type { ReactNode } from "react";
import { EditorProvider } from "@/features/editor/EditorContext";
import { EditorShell } from "@/features/editor/EditorShell";
import { loadEditorContext } from "@/lib/services/editor-context";

export const dynamic = "force-dynamic";

export default async function EditorLayout({ children, params }: { children: ReactNode; params: Promise<{ orgSlug: string; projectId: string }> }) {
  const { orgSlug, projectId } = await params;
  const ctx = await loadEditorContext(orgSlug, projectId);
  return (
    <EditorProvider project={ctx.project} doc={ctx.doc} revision={ctx.revision} etag={ctx.etag} targets={ctx.targets} canEdit={ctx.canEdit}>
      <EditorShell>{children}</EditorShell>
    </EditorProvider>
  );
}
