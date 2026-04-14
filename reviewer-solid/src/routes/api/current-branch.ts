import { createFileRoute } from "@tanstack/solid-router";
import { getCurrentBranch } from "~/server/diff-reviewer.start";

export const Route = createFileRoute("/api/current-branch")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        try {
          const url = new URL(request.url);
          const repoPath = url.searchParams.get("repoPath") || undefined;

          const branch = await getCurrentBranch(repoPath);
          return new Response(branch, {
            status: 200,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to fetch current branch";
          console.error("Error in /api/current-branch:", error);
          return new Response(message, { status: 500 });
        }
      },
    },
  },
});
