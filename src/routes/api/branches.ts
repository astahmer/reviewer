import { createFileRoute } from "@tanstack/react-router";
import { BranchInfo } from "~/lib/types";
import { getBranchesList } from "~/server/diff-reviewer.start";

export const Route = createFileRoute("/api/branches")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        try {
          const url = new URL(request.url);
          const repoPath = url.searchParams.get("repoPath") || undefined;

          return Response.json((await getBranchesList(repoPath)) as BranchInfo[]);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to fetch branches";
          console.error("Error in /api/branches:", error);
          return Response.json({ error: message }, { status: 500 });
        }
      },
    },
  },
});
