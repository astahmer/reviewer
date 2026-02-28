import { createFileRoute } from "@tanstack/react-router";
import { getCommitDistance } from "~/server/diff-reviewer.start";

export const Route = createFileRoute("/api/commit-distance")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        try {
          const url = new URL(request.url);
          const from = url.searchParams.get("from");
          const to = url.searchParams.get("to");
          const repoPath = url.searchParams.get("repoPath") || undefined;

          if (!from || !to) {
            return Response.json({ error: "Missing from or to parameter" }, { status: 400 });
          }

          const distance = await getCommitDistance(from, to, repoPath);
          return Response.json({ distance });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to fetch distance";
          console.error("Error in /api/commit-distance:", error);
          return Response.json({ error: message }, { status: 500 });
        }
      },
    },
  },
});
