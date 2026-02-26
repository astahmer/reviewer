/**
 * Simple Express-based API server for handling server-side operations
 * This runs alongside Vite in development mode
 */

import express from 'express'
import cors from 'cors'
import { getDiff, getCommitList, getCurrentBranch } from './src/server/diff-reviewer.start.js'

const app = express()
const port = 3001

app.use(cors())
app.use(express.json())

/**
 * GET /api/diff - Get diff between two commits
 * Query params: from, to
 */
app.get('/api/diff', async (req, res) => {
  try {
    const { from, to } = req.query

    if (!from || !to) {
      return res.status(400).json({ error: 'Missing required parameters: from and to' })
    }

    const diff = await getDiff(String(from), String(to))
    res.json(diff)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch diff'
    res.status(500).json({ error: message })
  }
})

/**
 * GET /api/commits - Get list of recent commits
 * Query params: limit (default: 20)
 */
app.get('/api/commits', async (req, res) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit) || '20'), 100)
    const commits = await getCommitList(limit)
    res.json(commits)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch commits'
    res.status(500).json({ error: message })
  }
})

/**
 * GET /api/current-branch - Get current branch name
 */
app.get('/api/current-branch', async (req, res) => {
  try {
    const branch = await getCurrentBranch()
    res.type('text/plain').send(branch)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch current branch'
    res.status(500).send(message)
  }
})

app.listen(port, () => {
  console.log(`API server listening at http://localhost:${port}`)
})
