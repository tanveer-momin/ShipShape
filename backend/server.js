import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import dns from 'node:dns/promises'
import net from 'node:net'

const app = express()
const PORT = process.env.PORT || 3000

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(__dirname, 'data')

const projectsFile = path.join(dataDir, 'projects.json')
const servicesFile = path.join(dataDir, 'services.json')
const incidentsFile = path.join(dataDir, 'incidents.json')

// =========================================================
// MIDDLEWARE
// =========================================================

app.use(cors())
app.use(express.json({ limit: '1mb' }))

// =========================================================
// STORAGE
// =========================================================

async function ensureJsonFile(filePath) {
  try {
    await fs.access(filePath)
  } catch {
    await fs.writeFile(filePath, '[]', 'utf8')
  }
}

async function initializeStorage() {
  await fs.mkdir(dataDir, { recursive: true })

  await Promise.all([
    ensureJsonFile(projectsFile),
    ensureJsonFile(servicesFile),
    ensureJsonFile(incidentsFile),
  ])
}

async function readJson(filePath) {
  const data = await fs.readFile(filePath, 'utf8')
  const parsed = JSON.parse(data)

  if (!Array.isArray(parsed)) {
    throw new Error(`Storage file must contain an array: ${filePath}`)
  }

  return parsed
}

async function writeJson(filePath, data) {
  await fs.writeFile(
    filePath,
    JSON.stringify(data, null, 2),
    'utf8'
  )
}

async function readProjects() {
  return readJson(projectsFile)
}

async function saveProjects(projects) {
  return writeJson(projectsFile, projects)
}

async function readServices() {
  return readJson(servicesFile)
}

async function saveServices(services) {
  return writeJson(servicesFile, services)
}

async function readIncidents() {
  return readJson(incidentsFile)
}

async function saveIncidents(incidents) {
  return writeJson(incidentsFile, incidents)
}

// =========================================================
// GITHUB HELPERS
// =========================================================

function parseGitHubRepoUrl(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return null
  }

  let parsedUrl

  try {
    parsedUrl = new URL(value.trim())
  } catch {
    return null
  }

  if (
    !['http:', 'https:'].includes(parsedUrl.protocol) ||
    parsedUrl.hostname.toLowerCase() !== 'github.com' ||
    parsedUrl.username ||
    parsedUrl.password
  ) {
    return null
  }

  const parts = parsedUrl.pathname
    .split('/')
    .filter(Boolean)

  if (parts.length !== 2) {
    return null
  }

  const owner = parts[0]
  const repo = parts[1].replace(/\.git$/i, '')

  if (!owner || !repo) {
    return null
  }

  return {
    owner,
    repo,
    url: `https://github.com/${owner}/${repo}`,
  }
}

function githubHeaders() {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'ShipShape',
    'X-GitHub-Api-Version': '2022-11-28',
  }

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
  }

  return headers
}

async function githubFetch(url, options = {}) {
  const controller = new AbortController()

  const timeout = setTimeout(() => {
    controller.abort()
  }, 10000)

  try {
    return await fetch(url, {
      ...options,
      headers: {
        ...githubHeaders(),
        ...(options.headers || {}),
      },
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeout)
  }
}

// =========================================================
// GITHUB LOG FETCH
// =========================================================

async function githubLogFetch(url) {
  const response = await githubFetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
    },
  })

  if (!response.ok) {
    const error = await getGitHubError(response)

    throw new Error(
      error.message ||
        `GitHub log request failed with ${response.status}`
    )
  }

  return response.text()
}

async function getGitHubError(response) {
  const body = await response.text()

  let message = body

  try {
    const parsed = JSON.parse(body)
    message = parsed.message || body
  } catch {
    // Keep original response body.
  }

  return {
    status: response.status,
    message,
    rateLimitRemaining: response.headers.get(
      'x-ratelimit-remaining'
    ),
    rateLimitReset: response.headers.get(
      'x-ratelimit-reset'
    ),
  }
}

function normalizeRun(run) {
  return {
    id: run.id,
    name: run.name,
    status: run.status,
    conclusion: run.conclusion,
    branch: run.head_branch,
    commit: run.head_sha,
    commitShort: run.head_sha
      ? run.head_sha.slice(0, 7)
      : null,
    runNumber: run.run_number,
    url: run.html_url,
    workflowPath: run.path,
    createdAt: run.created_at,
    updatedAt: run.updated_at,
    runStartedAt: run.run_started_at,
  }
}

function getRunState(run) {
  if (run.status !== 'completed') {
    return 'running'
  }

  if (run.conclusion === 'success') {
    return 'success'
  }

  if (
    [
      'failure',
      'cancelled',
      'timed_out',
      'startup_failure',
      'action_required',
    ].includes(run.conclusion)
  ) {
    return 'failed'
  }

  return 'unknown'
}

function getProjectDeliveryStatus(runs) {
  if (!runs.length) {
    return 'No runs'
  }

  const latest = runs[0]

  if (latest.status !== 'completed') {
    return 'Running'
  }

  if (latest.conclusion === 'success') {
    return 'Passing'
  }

  if (latest.conclusion) {
    return 'Failed'
  }

  return 'Unknown'
}

// =========================================================
// SERVICE URL SECURITY
// =========================================================

function isPrivateIp(address) {
  const version = net.isIP(address)

  if (version === 4) {
    const [a, b] = address.split('.').map(Number)

    return (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254)
    )
  }

  if (version === 6) {
    const normalized = address.toLowerCase()

    return (
      normalized === '::1' ||
      normalized === '::' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      normalized.startsWith('fe8') ||
      normalized.startsWith('fe9') ||
      normalized.startsWith('fea') ||
      normalized.startsWith('feb')
    )
  }

  return false
}

async function validateHealthUrl(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return {
      valid: false,
      message: 'Service URL is required',
    }
  }

  let parsed

  try {
    parsed = new URL(value.trim())
  } catch {
    return {
      valid: false,
      message: 'Enter a valid service URL',
    }
  }

  if (!['https:', 'http:'].includes(parsed.protocol)) {
    return {
      valid: false,
      message: 'Service URL must use HTTP or HTTPS',
    }
  }

  if (
    parsed.username ||
    parsed.password ||
    parsed.hostname === 'localhost'
  ) {
    return {
      valid: false,
      message: 'This service URL is not allowed',
    }
  }

  if (net.isIP(parsed.hostname)) {
    if (isPrivateIp(parsed.hostname)) {
      return {
        valid: false,
        message: 'Private network addresses are not allowed',
      }
    }

    return {
      valid: true,
      url: parsed.toString(),
    }
  }

  try {
    const addresses = await dns.lookup(parsed.hostname, {
      all: true,
    })

    if (!addresses.length) {
      return {
        valid: false,
        message: 'Could not resolve service hostname',
      }
    }

    if (
      addresses.some(({ address }) => isPrivateIp(address))
    ) {
      return {
        valid: false,
        message: 'Service hostname resolves to a private network',
      }
    }
  } catch {
    return {
      valid: false,
      message: 'Could not resolve service hostname',
    }
  }

  return {
    valid: true,
    url: parsed.toString(),
  }
}

// =========================================================
// API HEALTH
// =========================================================

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'ShipShape API is running',
    status: 'healthy',
    timestamp: new Date().toISOString(),
  })
})

// =========================================================
// GITHUB REPOSITORY
// =========================================================

app.get('/api/github/repo', async (req, res) => {
  try {
    const parsed = parseGitHubRepoUrl(req.query.url)

    if (!parsed) {
      return res.status(400).json({
        success: false,
        message:
          'Enter a valid URL like https://github.com/owner/repository',
      })
    }

    const response = await githubFetch(
      `https://api.github.com/repos/${encodeURIComponent(
        parsed.owner
      )}/${encodeURIComponent(parsed.repo)}`
    )

    if (!response.ok) {
      const error = await getGitHubError(response)

      console.error(
        'GitHub repository API error:',
        error
      )

      return res.status(response.status).json({
        success: false,
        message:
          error.message ||
          'GitHub could not verify this repository',
      })
    }

    const data = await response.json()

    return res.json({
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
    console.error(
      'Repository verification error:',
      error
    )

    return res.status(500).json({
      success: false,
      message: 'Could not connect to GitHub',
    })
  }
})

// =========================================================
// GITHUB ACTIONS RUNS
// =========================================================

app.get('/api/github/runs', async (req, res) => {
  try {
    const parsed = parseGitHubRepoUrl(req.query.url)

    if (!parsed) {
      return res.status(400).json({
        success: false,
        message: 'Enter a valid GitHub repository URL',
      })
    }

    const response = await githubFetch(
      `https://api.github.com/repos/${encodeURIComponent(
        parsed.owner
      )}/${encodeURIComponent(
        parsed.repo
      )}/actions/runs?per_page=20`
    )

    if (!response.ok) {
      const error = await getGitHubError(response)

      console.error(
        'GitHub Actions API error:',
        error
      )

      return res.status(response.status).json({
        success: false,
        message:
          error.message ||
          'Could not fetch GitHub Actions runs',
      })
    }

    const data = await response.json()

    const runs = (data.workflow_runs || []).map(
      normalizeRun
    )

    return res.json({
      success: true,
      total: data.total_count || 0,
      runs,
    })
  } catch (error) {
    console.error(
      'GitHub Actions request error:',
      error
    )

    return res.status(500).json({
      success: false,
      message: 'Could not connect to GitHub',
    })
  }
})

// =========================================================
// PROJECTS - GET ALL
// =========================================================

app.get('/api/projects', async (req, res) => {
  try {
    const projects = await readProjects()

    const enrichedProjects = await Promise.all(
      projects.map(async (project) => {
        try {
          const parsed = parseGitHubRepoUrl(
            project.repoUrl
          )

          if (!parsed) {
            return {
              ...project,
              status: 'Unknown',
            }
          }

          const response = await githubFetch(
            `https://api.github.com/repos/${encodeURIComponent(
              parsed.owner
            )}/${encodeURIComponent(
              parsed.repo
            )}/actions/runs?per_page=5`
          )

          if (!response.ok) {
            return {
              ...project,
              status: 'Unavailable',
            }
          }

          const data = await response.json()
          const runs = data.workflow_runs || []

          return {
            ...project,
            status: getProjectDeliveryStatus(runs),
            latestRun: runs[0]
              ? normalizeRun(runs[0])
              : null,
          }
        } catch {
          return {
            ...project,
            status: 'Unavailable',
          }
        }
      })
    )

    return res.json({
      success: true,
      projects: enrichedProjects,
    })
  } catch (error) {
    console.error(
      'Load projects error:',
      error
    )

    return res.status(500).json({
      success: false,
      message: 'Could not load projects',
    })
  }
})

// =========================================================
// PROJECTS - GET ONE
// =========================================================

app.get('/api/projects/:id', async (req, res) => {
  try {
    const projects = await readProjects()

    const project = projects.find(
      (item) => item.id === req.params.id
    )

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found',
      })
    }

    return res.json({
      success: true,
      project,
    })
  } catch (error) {
    console.error(
      'Get project error:',
      error
    )

    return res.status(500).json({
      success: false,
      message: 'Could not load project',
    })
  }
})

// =========================================================
// PROJECTS - CREATE
// =========================================================

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
        message:
          'Project name and repository URL are required',
      })
    }

    const parsed = parseGitHubRepoUrl(repoUrl)

    if (!parsed) {
      return res.status(400).json({
        success: false,
        message: 'Enter a valid GitHub repository URL',
      })
    }

    const projects = await readProjects()

    const duplicate = projects.find(
      (project) =>
        project.repoUrl.toLowerCase() ===
        parsed.url.toLowerCase()
    )

    if (duplicate) {
      return res.status(409).json({
        success: false,
        message:
          'This repository is already connected',
        project: duplicate,
      })
    }

    const verifyResponse = await githubFetch(
      `https://api.github.com/repos/${encodeURIComponent(
        parsed.owner
      )}/${encodeURIComponent(parsed.repo)}`
    )

    if (!verifyResponse.ok) {
      const error = await getGitHubError(
        verifyResponse
      )

      return res.status(verifyResponse.status).json({
        success: false,
        message:
          error.message ||
          'GitHub could not verify this repository',
      })
    }

    const repository = await verifyResponse.json()

    const project = {
      id: randomUUID(),
      name: name.trim(),
      repoUrl: parsed.url,

      repository: {
        fullName: repository.full_name,
        owner: repository.owner.login,
        name: repository.name,
        defaultBranch: repository.default_branch,
        visibility: repository.visibility,
      },

      status: 'No runs',
      createdAt: new Date().toISOString(),
    }

    projects.push(project)

    await saveProjects(projects)

    return res.status(201).json({
      success: true,
      message: 'Project connected successfully',
      project,
    })
  } catch (error) {
    console.error(
      'Create project error:',
      error
    )

    return res.status(500).json({
      success: false,
      message: 'Could not create project',
    })
  }
})

// =========================================================
// PROJECTS - DELETE
// =========================================================

app.delete('/api/projects/:id', async (req, res) => {
  try {
    const projects = await readProjects()

    const project = projects.find(
      (item) => item.id === req.params.id
    )

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found',
      })
    }

    const updatedProjects = projects.filter(
      (item) => item.id !== req.params.id
    )

    await saveProjects(updatedProjects)

    const services = await readServices()

    await saveServices(
      services.filter(
        (service) =>
          service.projectId !== req.params.id
      )
    )

    return res.json({
      success: true,
      message: 'Project deleted successfully',
    })
  } catch (error) {
    console.error(
      'Delete project error:',
      error
    )

    return res.status(500).json({
      success: false,
      message: 'Could not delete project',
    })
  }
})

// =========================================================
// PROJECT RUNS
// =========================================================

app.get('/api/projects/:id/runs', async (req, res) => {
  try {
    const projects = await readProjects()

    const project = projects.find(
      (item) => item.id === req.params.id
    )

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found',
      })
    }

    const parsed = parseGitHubRepoUrl(
      project.repoUrl
    )

    if (!parsed) {
      return res.status(400).json({
        success: false,
        message:
          'Project has an invalid GitHub repository',
      })
    }

    const response = await githubFetch(
      `https://api.github.com/repos/${encodeURIComponent(
        parsed.owner
      )}/${encodeURIComponent(
        parsed.repo
      )}/actions/runs?per_page=50`
    )

    if (!response.ok) {
      const error = await getGitHubError(response)

      return res.status(response.status).json({
        success: false,
        message:
          error.message ||
          'Could not fetch project runs',
      })
    }

    const data = await response.json()

    const runs = (data.workflow_runs || []).map(
      (run) => ({
        ...normalizeRun(run),
        state: getRunState(run),
        projectId: project.id,
        projectName: project.name,
        repository: project.repoUrl,
      })
    )

    return res.json({
      success: true,
      project,
      total: data.total_count || 0,
      runs,
    })
  } catch (error) {
    console.error(
      'Project runs error:',
      error
    )

    return res.status(500).json({
      success: false,
      message: 'Could not load project runs',
    })
  }
})

// =========================================================
// DELIVERIES - GET ALL
// =========================================================

app.get('/api/deliveries', async (req, res) => {
  try {
    const projects = await readProjects()

    const requestedProjectId =
      typeof req.query.projectId === 'string'
        ? req.query.projectId
        : null

    const selectedProjects = requestedProjectId
      ? projects.filter(
          (project) =>
            project.id === requestedProjectId
        )
      : projects

    const deliveries = []

    for (const project of selectedProjects) {
      const parsed = parseGitHubRepoUrl(
        project.repoUrl
      )

      if (!parsed) {
        continue
      }

      try {
        const response = await githubFetch(
          `https://api.github.com/repos/${encodeURIComponent(
            parsed.owner
          )}/${encodeURIComponent(
            parsed.repo
          )}/actions/runs?per_page=20`
        )

        if (!response.ok) {
          console.error(
            `Could not load runs for ${project.name}:`,
            await getGitHubError(response)
          )

          continue
        }

        const data = await response.json()

        for (const run of data.workflow_runs || []) {
          const normalized = normalizeRun(run)

          deliveries.push({
            id: String(run.id),

            projectId: project.id,
            projectName: project.name,

            repository: project.repoUrl,

            type: 'github_actions',

            name: normalized.name,

            branch: normalized.branch,

            commit: normalized.commit,
            commitShort: normalized.commitShort,

            runNumber: normalized.runNumber,

            status: normalized.status,
            conclusion: normalized.conclusion,

            state: getRunState(normalized),

            createdAt: normalized.createdAt,
            updatedAt: normalized.updatedAt,
            runStartedAt: normalized.runStartedAt,

            url: normalized.url,
          })
        }
      } catch (error) {
        console.error(
          `Could not load runs for ${project.name}:`,
          error
        )
      }
    }

    deliveries.sort(
      (a, b) =>
        new Date(b.createdAt) -
        new Date(a.createdAt)
    )

    return res.json({
      success: true,
      total: deliveries.length,
      deliveries,
    })
  } catch (error) {
    console.error(
      'Deliveries error:',
      error
    )

    return res.status(500).json({
      success: false,
      message: 'Could not load deliveries',
    })
  }
})

// =========================================================
// DELIVERY - GET ONE WITH JOB/STEP EVIDENCE
// =========================================================

app.get('/api/deliveries/:id', async (req, res) => {
  try {
    const projects = await readProjects()

    for (const project of projects) {
      const parsed = parseGitHubRepoUrl(
        project.repoUrl
      )

      if (!parsed) {
        continue
      }

      const runResponse = await githubFetch(
        `https://api.github.com/repos/${encodeURIComponent(
          parsed.owner
        )}/${encodeURIComponent(
          parsed.repo
        )}/actions/runs/${encodeURIComponent(
          req.params.id
        )}`
      )

      if (runResponse.status === 404) {
        continue
      }

      if (!runResponse.ok) {
        const error = await getGitHubError(
          runResponse
        )

        return res.status(runResponse.status).json({
          success: false,
          message:
            error.message ||
            'Could not load delivery',
        })
      }

      const run = await runResponse.json()

      const jobsResponse = await githubFetch(
        `https://api.github.com/repos/${encodeURIComponent(
          parsed.owner
        )}/${encodeURIComponent(
          parsed.repo
        )}/actions/runs/${encodeURIComponent(
          req.params.id
        )}/jobs?per_page=100`
      )

      if (!jobsResponse.ok) {
        const error = await getGitHubError(
          jobsResponse
        )

        return res.status(jobsResponse.status).json({
          success: false,
          message:
            error.message ||
            'Could not load delivery jobs',
        })
      }

      const jobsData = await jobsResponse.json()

      const jobs = (jobsData.jobs || []).map(
        (job) => {
          const steps = (job.steps || []).map(
            (step) => ({
              number: step.number,
              name: step.name,
              status: step.status,
              conclusion: step.conclusion,
              startedAt: step.started_at,
              completedAt: step.completed_at,
            })
          )

          return {
            id: job.id,
            name: job.name,
            status: job.status,
            conclusion: job.conclusion,
            startedAt: job.started_at,
            completedAt: job.completed_at,
            htmlUrl: job.html_url,
            steps,
          }
        }
      )

      const failedJobs = jobs.filter(
        (job) => job.conclusion === 'failure'
      )

      const failedSteps = jobs.flatMap(
        (job) =>
          job.steps
            .filter(
              (step) =>
                step.conclusion === 'failure'
            )
            .map((step) => ({
              ...step,
              jobName: job.name,
              jobId: job.id,
            }))
      )

      const normalized = normalizeRun(run)

      const delivery = {
        id: String(run.id),

        projectId: project.id,
        projectName: project.name,

        repository: project.repoUrl,

        type: 'github_actions',

        name: normalized.name,

        branch: normalized.branch,

        commit: normalized.commit,
        commitShort: normalized.commitShort,

        runNumber: normalized.runNumber,

        status: normalized.status,
        conclusion: normalized.conclusion,

        state: getRunState(normalized),

        createdAt: normalized.createdAt,
        updatedAt: normalized.updatedAt,
        runStartedAt: normalized.runStartedAt,

        url: normalized.url,

        workflowPath: normalized.workflowPath,

        jobs,

        evidence: {
          totalJobs: jobs.length,
          failedJobs: failedJobs.length,
          failedSteps: failedSteps.length,
          failedStepsDetails: failedSteps,
        },
      }

      return res.json({
        success: true,
        delivery,
      })
    }

    return res.status(404).json({
      success: false,
      message: 'Delivery not found',
    })
  } catch (error) {
    console.error(
      'Delivery detail error:',
      error
    )

    return res.status(500).json({
      success: false,
      message: 'Could not load delivery',
    })
  }
})

// =========================================================
// DELIVERY - GET JOB LOGS
// =========================================================

app.get('/api/deliveries/:id/logs', async (req, res) => {
  try {
    const projects = await readProjects()

    for (const project of projects) {
      const parsed = parseGitHubRepoUrl(
        project.repoUrl
      )

      if (!parsed) {
        continue
      }

      const jobsResponse = await githubFetch(
        `https://api.github.com/repos/${encodeURIComponent(
          parsed.owner
        )}/${encodeURIComponent(
          parsed.repo
        )}/actions/runs/${encodeURIComponent(
          req.params.id
        )}/jobs?per_page=100`
      )

      if (jobsResponse.status === 404) {
        continue
      }

      if (!jobsResponse.ok) {
        const error = await getGitHubError(
          jobsResponse
        )

        return res.status(jobsResponse.status).json({
          success: false,
          message:
            error.message ||
            'Could not load delivery jobs',
        })
      }

      const jobsData = await jobsResponse.json()
      const jobs = jobsData.jobs || []
      const logs = []

      for (const job of jobs) {
        try {
          const log = await githubLogFetch(
            `https://api.github.com/repos/${encodeURIComponent(
              parsed.owner
            )}/${encodeURIComponent(
              parsed.repo
            )}/actions/jobs/${encodeURIComponent(
              job.id
            )}/logs`
          )

          logs.push({
            jobId: job.id,
            jobName: job.name,
            conclusion: job.conclusion,
            log,
          })
        } catch (error) {
          logs.push({
            jobId: job.id,
            jobName: job.name,
            conclusion: job.conclusion,
            log: null,
            error: error.message,
          })
        }
      }

      return res.json({
        success: true,
        deliveryId: String(req.params.id),
        projectId: project.id,
        projectName: project.name,
        logs,
      })
    }

    return res.status(404).json({
      success: false,
      message: 'Delivery not found',
    })
  } catch (error) {
    console.error(
      'Delivery logs error:',
      error
    )

    return res.status(500).json({
      success: false,
      message: 'Could not load delivery logs',
    })
  }
})

// =========================================================
// SERVICES
// =========================================================

app.get('/api/services', async (req, res) => {
  try {
    const services = await readServices()

    return res.json({
      success: true,
      services,
    })
  } catch (error) {
    console.error(
      'Load services error:',
      error
    )

    return res.status(500).json({
      success: false,
      message: 'Could not load services',
    })
  }
})

// =========================================================
// SERVICES - CREATE
// =========================================================

app.post('/api/services', async (req, res) => {
  try {
    const {
      projectId,
      name,
      url,
      environment = 'production',
    } = req.body

    if (
      typeof projectId !== 'string' ||
      !projectId.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: 'Project is required',
      })
    }

    if (
      typeof name !== 'string' ||
      !name.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: 'Service name is required',
      })
    }

    const validation = await validateHealthUrl(url)

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.message,
      })
    }

    const projects = await readProjects()

    const project = projects.find(
      (item) => item.id === projectId
    )

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found',
      })
    }

    const services = await readServices()

    const duplicate = services.find(
      (service) =>
        service.projectId === projectId &&
        service.name.toLowerCase() ===
          name.trim().toLowerCase()
    )

    if (duplicate) {
      return res.status(409).json({
        success: false,
        message:
          'A service with this name already exists for this project',
      })
    }

    const service = {
      id: randomUUID(),
      projectId,
      projectName: project.name,
      name: name.trim(),
      url: validation.url,
      environment:
        typeof environment === 'string' &&
        environment.trim()
          ? environment.trim()
          : 'production',
      status: 'unknown',
      lastCheckedAt: null,
      responseTimeMs: null,
      statusCode: null,
      error: null,
      createdAt: new Date().toISOString(),
    }

    services.push(service)

    await saveServices(services)

    return res.status(201).json({
      success: true,
      message: 'Service created successfully',
      service,
    })
  } catch (error) {
    console.error(
      'Create service error:',
      error
    )

    return res.status(500).json({
      success: false,
      message: 'Could not create service',
    })
  }
})

// =========================================================
// SERVICES - HEALTH CHECK
// =========================================================

app.post('/api/services/:id/check', async (req, res) => {
  try {
    const services = await readServices()

    const serviceIndex = services.findIndex(
      (service) =>
        service.id === req.params.id
    )

    if (serviceIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Service not found',
      })
    }

    const service = services[serviceIndex]

    const validation = await validateHealthUrl(
      service.url
    )

    if (!validation.valid) {
      const updatedService = {
        ...service,
        status: 'down',
        lastCheckedAt: new Date().toISOString(),
        responseTimeMs: null,
        statusCode: null,
        error: validation.message,
      }

      services[serviceIndex] = updatedService

      await saveServices(services)

      return res.json({
        success: true,
        service: updatedService,
      })
    }

    const controller = new AbortController()

    const timeout = setTimeout(() => {
      controller.abort()
    }, 10000)

    const startedAt = Date.now()

    try {
      const response = await fetch(
        validation.url,
        {
          method: 'GET',
          redirect: 'manual',
          signal: controller.signal,
          headers: {
            'User-Agent': 'ShipShape-HealthCheck',
            Accept: '*/*',
          },
        }
      )

      const responseTimeMs =
        Date.now() - startedAt

      const status =
        response.status >= 200 &&
        response.status < 400
          ? 'healthy'
          : 'down'

      const updatedService = {
        ...service,
        status,
        lastCheckedAt:
          new Date().toISOString(),
        responseTimeMs,
        statusCode: response.status,
        error:
          status === 'healthy'
            ? null
            : `HTTP ${response.status}`,
      }

      services[serviceIndex] = updatedService

      await saveServices(services)

      return res.json({
        success: true,
        service: updatedService,
      })
    } catch (error) {
      const responseTimeMs =
        Date.now() - startedAt

      const message =
        error?.name === 'AbortError'
          ? 'Health check timed out'
          : error?.message ||
            'Health check failed'

      const updatedService = {
        ...service,
        status: 'down',
        lastCheckedAt:
          new Date().toISOString(),
        responseTimeMs,
        statusCode: null,
        error: message,
      }

      services[serviceIndex] = updatedService

      await saveServices(services)

      return res.json({
        success: true,
        service: updatedService,
      })
    } finally {
      clearTimeout(timeout)
    }
  } catch (error) {
    console.error(
      'Service health check error:',
      error
    )

    return res.status(500).json({
      success: false,
      message: 'Could not check service',
    })
  }
})

// =========================================================
// INCIDENTS
// =========================================================

app.get('/api/incidents', async (req, res) => {
  try {
    const incidents = await readIncidents()

    return res.json({
      success: true,
      incidents,
    })
  } catch (error) {
    console.error(
      'Load incidents error:',
      error
    )

    return res.status(500).json({
      success: false,
      message: 'Could not load incidents',
    })
  }
})

// =========================================================
// INCIDENTS - CREATE
// =========================================================

app.post('/api/incidents', async (req, res) => {
  try {
    const {
      projectId,
      deliveryId,
      title,
      severity = 'high',
      status = 'open',
      summary = '',
    } = req.body

    if (
      typeof projectId !== 'string' ||
      !projectId.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: 'Project is required',
      })
    }

    if (
      typeof title !== 'string' ||
      !title.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: 'Incident title is required',
      })
    }

    const projects = await readProjects()

    const project = projects.find(
      (item) => item.id === projectId
    )

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found',
      })
    }

    const incidents = await readIncidents()

    const incident = {
      id: randomUUID(),
      projectId,
      projectName: project.name,
      deliveryId:
        typeof deliveryId === 'string'
          ? deliveryId
          : null,
      title: title.trim(),
      severity:
        typeof severity === 'string'
          ? severity
          : 'high',
      status:
        typeof status === 'string'
          ? status
          : 'open',
      summary:
        typeof summary === 'string'
          ? summary.trim()
          : '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    incidents.push(incident)

    await saveIncidents(incidents)

    return res.status(201).json({
      success: true,
      message: 'Incident created successfully',
      incident,
    })
  } catch (error) {
    console.error(
      'Create incident error:',
      error
    )

    return res.status(500).json({
      success: false,
      message: 'Could not create incident',
    })
  }
})

// =========================================================
// START SERVER
// =========================================================

initializeStorage()
  .then(() => {
    app.listen(PORT, () => {
      console.log(
        `ShipShape API running on http://localhost:${PORT}`
      )

      console.log(
        `GitHub token: ${
          process.env.GITHUB_TOKEN
            ? 'configured'
            : 'not configured'
        }`
      )
    })
  })
  .catch((error) => {
    console.error(
      'Failed to initialize storage:',
      error
    )

    process.exit(1)
  })