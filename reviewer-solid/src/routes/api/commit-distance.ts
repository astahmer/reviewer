import { createFileRoute } from "@tanstack/solid-router";
import { getCommitDistance } from "~/server/diff-reviewer.start";

export const Route = createFileRoute("/api/commit-distance")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        try {
          const url = new URL(request.url);
          const base = url.searchParams.get("base");
          const head = url.searchParams.get("head");
          const repoPath = url.searchParams.get("repoPath") || undefined;

          if (!base || !head) {
            return Response.json({ error: "Missing base or head parameter" }, { status: 400 });
          }

          const distance = await getCommitDistance(base, head, repoPath);
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
