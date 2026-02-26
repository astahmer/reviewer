import { createFileRoute } from '@tanstack/react-router'
import { getBranchesList } from '~/server/diff-reviewer.start'

export const Route = createFileRoute('/api/branches')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        try {
          const url = new URL(request.url)
          const repoPath = url.searchParams.get('repoPath') || undefined

          const branches = await getBranchesList(repoPath)
          return Response.json(branches)
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to fetch branches'
          console.error('Error in /api/branches:', error)
          return Response.json({ error: message }, { status: 500 })
        }
      },
    },
  },
})
