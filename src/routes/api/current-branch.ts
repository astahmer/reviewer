import { createFileRoute } from '@tanstack/react-router'
import { getCurrentBranch } from '~/server/diff-reviewer.start'

export const Route = createFileRoute('/api/current-branch')({
  component: () => null,
  server: {
    handlers: {
      GET: async (_: { request: Request }) => {
        try {
          const branch = await getCurrentBranch()
          return new Response(branch, {
            status: 200,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          })
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to fetch current branch'
          console.error('Error in /api/current-branch:', error)
          return new Response(message, { status: 500 })
        }
      },
    },
  },
})
