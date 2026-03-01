import { createFileRoute } from "@tanstack/react-router";
import { getBranchesList, getCommitList } from "~/server/diff-reviewer.start";
import { BranchInfo } from "~/lib/types";

export const Route = createFileRoute("/api/branches-with-commits")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        try {
          const url = new URL(request.url);
          const repoPath = url.searchParams.get("repoPath") || undefined;

          const branchNames = await getBranchesList(repoPath);

          // Fetch latest commit for each branch
          const branchesWithCommits = await Promise.all(
            branchNames.map(async (branchName): Promise<BranchInfo> => {
              try {
                const commits = await getCommitList(1, repoPath, branchName);
                return {
                  name: branchName,
                  latestCommit: commits[0] || {
                    hash: "",
                    message: "No commits",
                    author: "",
                    date: new Date(),
                  },
                };
              } catch {
                return {
                  name: branchName,
                  latestCommit: {
                    hash: "",
                    message: "Failed to load",
                    author: "",
                    date: new Date(),
                  },
                };
              }
            }),
          );

          // Sort by latest commit date (most recent first)
          const sorted = branchesWithCommits.sort(
            (a, b) =>
              new Date(b.latestCommit.date).getTime() - new Date(a.latestCommit.date).getTime(),
          );

          return Response.json(sorted);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Failed to fetch branches with commits";
          console.error("Error in /api/branches-with-commits:", error);
          return Response.json({ error: message }, { status: 500 });
        }
      },
    },
  },
});
