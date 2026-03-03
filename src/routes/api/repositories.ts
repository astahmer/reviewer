import { createFileRoute } from "@tanstack/react-router";
import { getRepositoryList } from "~/server/diff-reviewer.start";

export const Route = createFileRoute("/api/repositories")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        try {
          const url = new URL(request.url);
          const basePaths = url.searchParams.getAll("basePath");

          const repos = await getRepositoryList(basePaths.length > 0 ? basePaths : undefined);
          return Response.json(repos);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to fetch repositories";
          console.error("Error in /api/repositories:", error);
          return Response.json({ error: message }, { status: 500 });
        }
      },
    },
  },
});
