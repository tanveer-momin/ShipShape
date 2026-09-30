import {
  AlertCircle,
  Check,
  CheckCircle2,
  ExternalLink,
  GitBranch,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
  XCircle,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { getRepository } from '../lib/api'
import { useShipShape } from '../context/ShipShapeContext'

function getLatestDeployment(project, deployments) {
  return deployments.find(
    (deployment) => deployment.projectId === project.id
  )
}

function getProjectStatus(project, deployments) {
  const latest = getLatestDeployment(
    project,
    deployments
  )

  if (!latest) {
    return {
      label: 'No runs',
      className: 'status-neutral',
    }
  }

  if (latest.conclusion === 'success') {
  return {
    label: 'Passing',
    className: 'status-success',
  }
}

  if (latest.conclusion === 'failure') {
    return {
      label: 'Failed',
      className: 'status-danger',
    }
  }

  if (
    latest.status === 'in_progress' ||
    latest.status === 'queued'
  ) {
    return {
      label: 'Running',
      className: 'status-running',
    }
  }

  return {
    label: latest.status || 'Unknown',
    className: 'status-neutral',
  }
}

function Projects() {
  const {
    projects,
    deployments,
    loading,
    refreshing,
    refreshAll,
    addProject,
    removeProject,
  } = useShipShape()

  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)

  const filteredProjects = useMemo(() => {
    const query = search.trim().toLowerCase()

    if (!query) return projects

    return projects.filter((project) => {
      return (
        project.name?.toLowerCase().includes(query) ||
        project.repoUrl?.toLowerCase().includes(query)
      )
    })
  }, [projects, search])

  return (
    <div className="page-stack">
      <section className="page-header-row">
        <div>
          <div className="eyebrow">
            <GitBranch size={14} />
            Workspace
          </div>

          <h1>Projects</h1>

          <p className="page-description">
            Repositories connected to ShipShape and their latest
            delivery state.
          </p>
        </div>

        <button
          className="button-primary"
          onClick={() => setShowModal(true)}
        >
          <Plus size={16} />
          Connect project
        </button>
      </section>

      <section className="toolbar-panel">
        <div className="search-field">
          <Search size={17} />

          <input
            type="text"
            placeholder="Search projects or repositories..."
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
          />

          {search && (
            <button
              className="search-clear"
              onClick={() => setSearch('')}
              aria-label="Clear search"
            >
              <X size={15} />
            </button>
          )}
        </div>

        <button
          className="button-secondary"
          onClick={() => refreshAll({ silent: true })}
          disabled={refreshing}
        >
          <RefreshCw
            size={16}
            className={refreshing ? 'spin' : ''}
          />

          Refresh
        </button>
      </section>

      <section className="panel projects-panel">
        <div className="panel-header">
          <div>
            <span className="panel-kicker">
              Connected repositories
            </span>

            <h2>
              {projects.length}{' '}
              {projects.length === 1
                ? 'project'
                : 'projects'}
            </h2>
          </div>
        </div>

        {loading ? (
          <ProjectLoading />
        ) : filteredProjects.length === 0 ? (
          <ProjectsEmpty
            hasProjects={projects.length > 0}
            onAdd={() => setShowModal(true)}
          />
        ) : (
          <div className="projects-table">
            <div className="projects-table-header">
              <span>Project</span>
              <span>Repository</span>
              <span>Latest run</span>
              <span>Status</span>
              <span />
            </div>

            {filteredProjects.map((project) => {
              const latestRun =
                getLatestDeployment(
                  project,
                  deployments
                )

              const status =
                getProjectStatus(
                  project,
                  deployments
                )

              return (
                <ProjectRow
                  key={project.id}
                  project={project}
                  latestRun={latestRun}
                  status={status}
                  onDelete={removeProject}
                />
              )
            })}
          </div>
        )}
      </section>

      {showModal && (
        <ConnectProjectModal
          projects={projects}
          onClose={() => setShowModal(false)}
          onCreate={addProject}
        />
      )}
    </div>
  )
}

function ProjectRow({
  project,
  latestRun,
  status,
  onDelete,
}) {
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    const confirmed = window.confirm(
      `Remove "${project.name}" from ShipShape?`
    )

    if (!confirmed) return

    try {
      setDeleting(true)
      await onDelete(project.id)
    } catch (error) {
      window.alert(
        error?.message ||
          'Unable to remove project.'
      )
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="project-table-row">
      <Link
        to={`/projects/${project.id}`}
        className="project-cell-main"
      >
        <div className="project-row-icon">
          <GitBranch size={17} />
        </div>

        <div>
          <strong>{project.name}</strong>

          <span>
            Connected{' '}
            {project.createdAt
              ? new Date(
                  project.createdAt
                ).toLocaleDateString()
              : ''}
          </span>
        </div>
      </Link>

      <a
        className="repository-cell"
        href={project.repoUrl}
        target="_blank"
        rel="noreferrer"
      >
        <span>{project.repoUrl}</span>
        <ExternalLink size={14} />
      </a>

      <div className="latest-run-cell">
        {latestRun ? (
          <>
            <strong>
              {latestRun.name ||
                'GitHub Actions'}
            </strong>

            <span>
              {latestRun.head_branch ||
                latestRun.branch ||
                'unknown'}
            </span>
          </>
        ) : (
          <span className="muted">
            No workflow runs
          </span>
        )}
      </div>

      <div>
        <span
          className={`status-badge ${status.className}`}
        >
          {status.label}
        </span>
      </div>

      <div className="project-actions">
        <Link
          to={`/projects/${project.id}`}
          className="icon-button"
          title="Open project"
        >
          <ExternalLink size={16} />
        </Link>

        <button
          className="icon-button icon-button-danger"
          onClick={handleDelete}
          disabled={deleting}
          title="Remove project"
        >
          {deleting ? (
            <Loader2
              size={16}
              className="spin"
            />
          ) : (
            <Trash2 size={16} />
          )}
        </button>
      </div>
    </div>
  )
}

function ConnectProjectModal({
  projects,
  onClose,
  onCreate,
}) {
  const [name, setName] = useState('')
  const [repoUrl, setRepoUrl] = useState('')

  const [verifying, setVerifying] = useState(false)
  const [creating, setCreating] = useState(false)

  const [verifiedRepo, setVerifiedRepo] =
    useState(null)

  const [error, setError] = useState('')

  function resetVerification() {
    setVerifiedRepo(null)
    setError('')
  }

  function handleRepoChange(event) {
    setRepoUrl(event.target.value)
    resetVerification()
  }

  async function handleVerify() {
    setError('')

    if (!repoUrl.trim()) {
      setError('Enter a GitHub repository URL.')
      return
    }

    const duplicate = projects.some(
      (project) =>
        project.repoUrl?.toLowerCase() ===
        repoUrl.trim().toLowerCase()
    )

    if (duplicate) {
      setError(
        'This repository is already connected to ShipShape.'
      )
      return
    }

    try {
      setVerifying(true)

      const result =
        await getRepository(repoUrl.trim())

      if (!result.success) {
        throw new Error(
          result.message ||
            'Repository verification failed.'
        )
      }

      setVerifiedRepo(result.repository)

      if (!name.trim()) {
        setName(
          result.repository?.name ||
            ''
        )
      }
    } catch (err) {
      setVerifiedRepo(null)

      setError(
        err?.message ||
          'Unable to verify this repository.'
      )
    } finally {
      setVerifying(false)
    }
  }

  async function handleCreate(event) {
    event.preventDefault()

    setError('')

    if (!name.trim()) {
      setError('Project name is required.')
      return
    }

    if (!repoUrl.trim()) {
      setError('Repository URL is required.')
      return
    }

    if (!verifiedRepo) {
      setError(
        'Verify the GitHub repository before connecting it.'
      )
      return
    }

    try {
      setCreating(true)

      await onCreate({
        name: name.trim(),
        repoUrl: repoUrl.trim(),
      })

      onClose()
    } catch (err) {
      setError(
        err?.message ||
          'Unable to create the project.'
      )
    } finally {
      setCreating(false)
    }
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <div className="modal">
        <div className="modal-header">
          <div>
            <span className="panel-kicker">
              Project onboarding
            </span>

            <h2>Connect repository</h2>

            <p>
              Connect a GitHub repository to begin
              tracking its delivery pipeline.
            </p>
          </div>

          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <form
          className="modal-form"
          onSubmit={handleCreate}
        >
          <label>
            <span>Project name</span>

            <input
              value={name}
              onChange={(event) =>
                setName(event.target.value)
              }
              placeholder="e.g. ShipShape"
              disabled={creating}
            />
          </label>

          <label>
            <span>GitHub repository</span>

            <div className="input-with-action">
              <input
                value={repoUrl}
                onChange={handleRepoChange}
                placeholder="https://github.com/owner/repository"
                disabled={creating}
              />

              <button
                type="button"
                className="button-secondary"
                onClick={handleVerify}
                disabled={
                  verifying ||
                  creating ||
                  !repoUrl.trim()
                }
              >
                {verifying ? (
                  <>
                    <Loader2
                      size={15}
                      className="spin"
                    />
                    Verifying
                  </>
                ) : (
                  <>
                    <Check size={15} />
                    Verify
                  </>
                )}
              </button>
            </div>
          </label>

          {verifiedRepo && (
            <div className="verification-success">
              <CheckCircle2 size={18} />

              <div>
                <strong>
                  Repository verified
                </strong>

                <span>
                  {verifiedRepo.full_name ||
                    verifiedRepo.name ||
                    repoUrl}
                </span>
              </div>
            </div>
          )}

          {error && (
            <div className="form-error">
              <AlertCircle size={17} />
              <span>{error}</span>
            </div>
          )}

          <div className="modal-footer">
            <button
              type="button"
              className="button-secondary"
              onClick={onClose}
              disabled={creating}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="button-primary"
              disabled={
                creating ||
                verifying ||
                !verifiedRepo
              }
            >
              {creating ? (
                <>
                  <Loader2
                    size={16}
                    className="spin"
                  />
                  Connecting
                </>
              ) : (
                <>
                  <Plus size={16} />
                  Connect project
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ProjectLoading() {
  return (
    <div className="projects-loading">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          className="project-loading-row"
          key={index}
        >
          <div className="loading-block loading-icon" />

          <div className="loading-content">
            <div className="loading-block loading-line" />
            <div className="loading-block loading-line-short" />
          </div>

          <div className="loading-block loading-wide" />
          <div className="loading-block loading-status" />
        </div>
      ))}
    </div>
  )
}

function ProjectsEmpty({
  hasProjects,
  onAdd,
}) {
  return (
    <div className="empty-state projects-empty">
      <div className="empty-state-icon">
        <GitBranch size={21} />
      </div>

      <strong>
        {hasProjects
          ? 'No projects match your search'
          : 'No projects connected'}
      </strong>

      <p>
        {hasProjects
          ? 'Try a different project name or repository.'
          : 'Connect a GitHub repository to start tracking builds and deployments.'}
      </p>

      {!hasProjects && (
        <button
          className="button-primary"
          onClick={onAdd}
        >
          <Plus size={16} />
          Connect project
        </button>
      )}
    </div>
  )
}

export default Projects