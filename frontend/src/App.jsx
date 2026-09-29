
import { useEffect, useState } from 'react'
import './App.css'

const API_URL = 'http://localhost:3000/api'

function App() {
  const [apiStatus, setApiStatus] = useState('checking')
  const [projects, setProjects] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [projectName, setProjectName] = useState('')
  const [repoUrl, setRepoUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [verifiedRepo, setVerifiedRepo] = useState(null)
  const [verifying, setVerifying] = useState(false)

  async function loadProjects() {
    const response = await fetch(`${API_URL}/projects`)
    if (!response.ok) throw new Error('Could not load projects')

    const data = await response.json()
    setProjects(data.projects || [])
  }

  useEffect(() => {
    async function initialize() {
      try {
        const response = await fetch(`${API_URL}/health`)
        if (!response.ok) throw new Error('API unavailable')

        const data = await response.json()
        if (data.status !== 'healthy') throw new Error('API unavailable')

        setApiStatus('connected')
        await loadProjects()
      } catch {
        setApiStatus('error')
      }
    }

    initialize()
  }, [])

  function openProjectForm() {
    setError('')
    setSuccess('')
    setShowForm(true)
  }

  
async function handleVerifyRepository() {
  setError('')
  setSuccess('')
  setVerifiedRepo(null)

  if (!repoUrl.trim()) {
    setError('Enter a GitHub repository URL first.')
    return
  }

  setVerifying(true)

  try {
    const response = await fetch(
      `${API_URL}/github/repo?url=${encodeURIComponent(repoUrl.trim())}`
    )

    const data = await response.json()

    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Repository verification failed')
    }

    setVerifiedRepo(data.repository)

    // Use the repository name as the project name if it's empty.
    if (!projectName.trim()) {
      setProjectName(data.repository.name)
    }
  } catch (err) {
    setError(
      err.message === 'Failed to fetch'
        ? 'Cannot reach the backend. Make sure the API server is running.'
        : err.message
    )
  } finally {
    setVerifying(false)
  }
}

  async function handleSubmit(event) {
    event.preventDefault()
    if (!verifiedRepo) {
  setError('Please verify the GitHub repository before adding the project.')
  return
}
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      const response = await fetch(`${API_URL}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: projectName.trim(),
          repoUrl: repoUrl.trim(),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Could not create project')
      }

      setProjects((current) => [...current, data.project])
      setProjectName('')
      setRepoUrl('')
      setShowForm(false)
      setSuccess('Project added successfully!')
    } catch (err) {
      setError(
        err.message === 'Failed to fetch'
          ? 'Cannot reach the backend. Make sure the API server is running.'
          : err.message
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">S</div>
          <span>shipshape<span className="brand-dot">.</span></span>
        </div>

        <div className="workspace">
          <div className="workspace-icon">T</div>
          <div>
            <strong>Tanveer's Workspace</strong>
            <small>Free Plan</small>
          </div>
          <span className="chevron">⌄</span>
        </div>

        <p className="nav-label">WORKSPACE</p>
        <nav>
          <a className="nav-item active" href="#overview">
            <span>◫</span> Overview
          </a>
          <a className="nav-item" href="#deployments">
            <span>↗</span> Deployments
          </a>
          <a className="nav-item" href="#projects">
            <span>◈</span> Projects
          </a>
          <a className="nav-item" href="#activity">
            <span>≡</span> Activity
          </a>
        </nav>

        <div className="sidebar-bottom">
          <a className="nav-item" href="#settings">
            <span>⚙</span> Settings
          </a>
          <div className="profile">
            <div className="avatar">TM</div>
            <div>
              <strong>Tanveer Momin</strong>
              <small>Workspace Owner</small>
            </div>
            <span className="chevron">···</span>
          </div>
        </div>
      </aside>

      <main className="main-content" id="overview">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <span>/</span> <strong>Overview</strong>
          </div>
          <div className="top-actions">
            <span className={`status-pill ${apiStatus}`}>
              <i />
              {apiStatus === 'checking'
                ? 'Connecting to API...'
                : apiStatus === 'connected'
                  ? 'API connected'
                  : 'API unavailable'}
            </span>
            <button className="icon-button" aria-label="Notifications">
              ♧
            </button>
          </div>
        </header>

        <section className="page-heading">
          <div>
            <p className="eyebrow">YOUR COMMAND CENTER</p>
            <h1>Good evening, Tanveer <span>✦</span></h1>
            <p className="subtitle">
              Manage your repositories and track your projects.
            </p>
          </div>
          <button className="primary-button" onClick={openProjectForm}>
            <span>＋</span> New project
          </button>
        </section>

        {error && (
          <div className="notice error-notice" role="alert">
            {error}
          </div>
        )}

        {success && (
          <div className="notice success-notice" role="status">
            {success}
          </div>
        )}

        {showForm && (
          <section className="panel project-form-panel">
            <div className="panel-heading">
              <div>
                <h3>Connect a repository</h3>
                <p>Add a project to your ShipShape workspace.</p>
              </div>
              <button
                className="text-button"
                onClick={() => setShowForm(false)}
                type="button"
              >
                Cancel ✕
              </button>
            </div>

            <form className="project-form" onSubmit={handleSubmit}>
              <label htmlFor="project-name">Project name</label>
              <input
                id="project-name"
                type="text"
                placeholder="e.g. My Portfolio"
                value={projectName}
                onChange={(event) => setProjectName(event.target.value)}
                required
                maxLength={100}
              />

              
<label htmlFor="repo-url">GitHub repository URL</label>
<input
  id="repo-url"
  type="url"
  placeholder="https://github.com/username/repository"
  value={repoUrl}
  onChange={(event) => {
    setRepoUrl(event.target.value)
    setVerifiedRepo(null)
    setError('')
  }}
  required
/>

<button
  className="secondary-button verify-button"
  type="button"
  onClick={handleVerifyRepository}
  disabled={verifying || !repoUrl.trim()}
>
  {verifying ? 'Verifying...' : '↗ Verify Repository'}
</button>

{verifiedRepo && (
  <div className="verified-repo">
    <div className="verified-heading">
      <span className="verified-check">✓</span>
      <strong>Repository verified</strong>
    </div>

    <h4>{verifiedRepo.fullName}</h4>

    <p>
      {verifiedRepo.description || 'No repository description available.'}
    </p>

    <div className="verified-details">
      <span>
        Default branch: <strong>{verifiedRepo.defaultBranch}</strong>
      </span>
      <span>
        Visibility: <strong>{verifiedRepo.visibility}</strong>
      </span>
    </div>

    <a
      href={verifiedRepo.url}
      target="_blank"
      rel="noreferrer"
    >
      View on GitHub ↗
    </a>
  </div>
)}

              <button
                className="primary-button"
                type="submit"
               disabled={loading || verifying || apiStatus !== 'connected' || !verifiedRepo}
              >
                {loading ? 'Adding project...' : '＋ Add project'}
              </button>
            </form>
          </section>
        )}

        <section className="stats-grid">
          <div className="stat-card">
            <div className="stat-top">
              <span>Projects</span>
              <span className="stat-icon purple">◫</span>
            </div>
            <h2>{projects.length}</h2>
            <p>{projects.length === 1 ? '1 project connected' : `${projects.length} projects connected`}</p>
          </div>

          <div className="stat-card">
            <div className="stat-top">
              <span>Deployments</span>
              <span className="stat-icon blue">↗</span>
            </div>
            <h2>0</h2>
            <p>Deployment tracking not connected</p>
          </div>

          <div className="stat-card">
            <div className="stat-top">
              <span>Active services</span>
              <span className="stat-icon green">◈</span>
            </div>
            <h2>0</h2>
            <p>No services monitored yet</p>
          </div>

          <div className="stat-card">
            <div className="stat-top">
              <span>Failed deployments</span>
              <span className="stat-icon orange">⚠</span>
            </div>
            <h2>0</h2>
            <p>No deployment data yet</p>
          </div>
        </section>

        <section className="panel projects-panel" id="projects">
          <div className="panel-heading">
            <div>
              <h3>Your projects</h3>
              <p>Repositories connected to this workspace</p>
            </div>
            <button className="text-button" onClick={openProjectForm}>
              ＋ Add project
            </button>
          </div>

          {projects.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">◈</div>
              <h4>No projects yet</h4>
              <p>
                Connect a GitHub repository to start organizing your projects.
              </p>
              <button className="secondary-button" onClick={openProjectForm}>
                Connect a repository ↗
              </button>
            </div>
          ) : (
            <div className="project-list">
              {projects.map((project) => (
                <article className="project-item" key={project.id}>
                  <div className="project-symbol">◈</div>
                  <div className="project-info">
                    <h4>{project.name}</h4>
                    <a
                      href={project.repoUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {project.repoUrl}
                    </a>
                    <small>
                      Added {new Date(project.createdAt).toLocaleDateString()}
                    </small>
                  </div>
                  <span className="project-status">
                    {project.status || 'Not connected'}
                  </span>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="content-grid">
          <div className="panel activity-panel" id="activity">
            <div className="panel-heading">
              <div>
                <h3>Recent activity</h3>
                <p>Your latest deployment events</p>
              </div>
            </div>

            <div className="empty-state">
              <div className="empty-icon">⌁</div>
              <h4>No activity yet</h4>
              <p>
                Deployment activity will appear here once tracking is connected.
              </p>
            </div>
          </div>

          <div className="panel services-panel" id="deployments">
            <div className="panel-heading">
              <div>
                <h3>Services</h3>
                <p>Monitor your running services</p>
              </div>
              <span className="count-badge">0</span>
            </div>

            <div className="service-empty">
              <div className="service-symbol">◈</div>
              <h4>No services connected</h4>
              <p>
                Service health monitoring is not connected yet.
              </p>
            </div>
          </div>
        </section>

        <section className="panel getting-started">
          <div className="getting-icon">✦</div>
          <div className="getting-copy">
            <span className="eyebrow">NEXT STEP</span>
            <h3>Build and deploy your first project.</h3>
            <p>
              Your repositories are now saved. Next, we'll connect build
              tracking and deployment health.
            </p>
          </div>
          <button className="secondary-button" onClick={openProjectForm}>
            Add a repository ↗
          </button>
        </section>

        <footer className="footer">
          <span>ShipShape <span className="footer-dot">●</span> Build. Deploy. Automate.</span>
          <span>{projects.length} saved project{projects.length === 1 ? '' : 's'} · Deployment tracking coming next</span>
        </footer>
      </main>
    </div>
  )
}

export default App