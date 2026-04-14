import { createFileRoute } from "@tanstack/solid-router";
import { getFileContent } from "~/server/diff-reviewer.start";

export const Route = createFileRoute("/api/file-content")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        try {
          const url = new URL(request.url);
          const filePath = url.searchParams.get("filePath");
          const commit = url.searchParams.get("commit");
          const repoPath = url.searchParams.get("repoPath") || undefined;

          if (!filePath || !commit) {
            return Response.json(
              { error: "Missing required parameters: filePath and commit" },
              { status: 400 },
            );
          }

          const content = await getFileContent(filePath, commit, repoPath);
          return Response.json({ content });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to fetch file content";
          console.error("Error in /api/file-content:", error);
          return Response.json({ error: message }, { status: 500 });
        }
      },
    },
  },
});
