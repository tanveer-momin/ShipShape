
import express from 'express'
import cors from 'cors'
import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const app = express()
const PORT = 3000

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(__dirname, 'data')
const dataFile = path.join(dataDir, 'projects.json')

app.use(cors())
app.use(express.json())

// Create the data file if it doesn't exist
async function initializeStorage() {
  await fs.mkdir(dataDir, { recursive: true })

  try {
    await fs.access(dataFile)
  } catch {
    await fs.writeFile(dataFile, '[]', 'utf8')
  }
}

async function readProjects() {
  const data = await fs.readFile(dataFile, 'utf8')
  return JSON.parse(data)
}

async function saveProjects(projects) {
  await fs.writeFile(
    dataFile,
    JSON.stringify(projects, null, 2),
    'utf8'
  )
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'ShipShape API is running',
    status: 'healthy',
  })
})


 // Verify and fetch a public GitHub repository
app.get('/api/github/repo', async (req, res) => {
  try {
    const { url } = req.query

    if (!url || typeof url !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Please provide a GitHub repository URL',
      })
    }

    let parsedUrl

    try {
      parsedUrl = new URL(url)
    } catch {
      return res.status(400).json({
        success: false,
        message: 'Invalid repository URL',
      })
    }

    if (
      parsedUrl.hostname !== 'github.com' ||
      !['http:', 'https:'].includes(parsedUrl.protocol)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid GitHub URL',
      })
    }

    const parts = parsedUrl.pathname
      .split('/')
      .filter(Boolean)

    if (parts.length !== 2) {
      return res.status(400).json({
        success: false,
        message: 'Use a URL like https://github.com/owner/repository',
      })
    }

    const [owner, repo] = parts

    const response = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'ShipShape',
        },
      }
    )

    if (response.status === 404) {
      return res.status(404).json({
        success: false,
        message: 'Repository not found or not publicly accessible',
      })
    }

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        message: 'GitHub could not verify this repository right now',
      })
    }

    const data = await response.json()

    res.json({
      success: true,
      repository: {
        name: data.name,
        fullName: data.full_name,
        owner: data.owner.login,
        description: data.description,
        url: data.html_url,
        defaultBranch: data.default_branch,
        visibility: data.visibility,
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Could not connect to GitHub',
    })
  }
})

// Get all projects
app.get('/api/projects', async (req, res) => {
  try {
    const projects = await readProjects()
    res.json({ success: true, projects })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Could not load projects',
    })
  }
})

// Create a project
app.post('/api/projects', async (req, res) => {
  try {
    const { name, repoUrl } = req.body

    if (
      typeof name !== 'string' ||
      !name.trim() ||
      typeof repoUrl !== 'string' ||
      !repoUrl.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: 'Project name and repository URL are required',
      })
    }

    let parsedUrl

    try {
      parsedUrl = new URL(repoUrl.trim())
    } catch {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid repository URL',
      })
    }

    if (
      !['http:', 'https:'].includes(parsedUrl.protocol) ||
      parsedUrl.hostname !== 'github.com' ||
      parsedUrl.pathname.split('/').filter(Boolean).length < 2
    ) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid GitHub repository URL',
      })
    }

    const projects = await readProjects()

    const project = {
      id: randomUUID(),
      name: name.trim(),
      repoUrl: parsedUrl.href,
      status: 'Not connected',
      createdAt: new Date().toISOString(),
    }

    projects.push(project)
    await saveProjects(projects)

    res.status(201).json({
      success: true,
      message: 'Project created successfully',
      project,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Could not create project',
    })
  }
})

initializeStorage()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`ShipShape API running at http://localhost:${PORT}`)
    })
  })
  .catch((error) => {
    console.error('Could not initialize project storage:', error)
    process.exit(1)
  })