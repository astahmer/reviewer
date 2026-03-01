import { createFileRoute } from "@tanstack/react-router";
import { getDiff } from "~/server/diff-reviewer.start";

export const Route = createFileRoute("/api/diff")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        try {
          const url = new URL(request.url);
          const base = url.searchParams.get("base");
          const head = url.searchParams.get("head");
          const repoPath = url.searchParams.get("repoPath") || undefined;

          if (!base || !head) {
            return Response.json(
              { error: "Missing required parameters: base and head" },
              { status: 400 },
            );
          }

          const diff = await getDiff(base, head, repoPath);
          return Response.json(diff);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to fetch diff";
          console.error("Error in /api/diff:", error);
          return Response.json({ error: message }, { status: 500 });
        }
      },
    },
  },
});
