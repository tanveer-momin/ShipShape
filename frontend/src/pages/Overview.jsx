import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  CircleAlert,
  GitBranch,
  Layers3,
  RefreshCw,
  Server,
  XCircle,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useShipShape } from '../context/ShipShapeContext'

function formatRelativeTime(dateValue) {
  if (!dateValue) return 'Unknown time'

  const date = new Date(dateValue)

  if (Number.isNaN(date.getTime())) {
    return 'Unknown time'
  }

  const diff = Date.now() - date.getTime()

  const seconds = Math.floor(diff / 1000)

  if (seconds < 60) {
    return `${Math.max(seconds, 1)}s ago`
  }

  const minutes = Math.floor(seconds / 60)

  if (minutes < 60) {
    return `${minutes}m ago`
  }

  const hours = Math.floor(minutes / 60)

  if (hours < 24) {
    return `${hours}h ago`
  }

  const days = Math.floor(hours / 24)

  return `${days}d ago`
}

function getRunStatus(run) {
  if (run.conclusion === 'success') {
    return {
      label: 'Successful',
      className: 'status-success',
      icon: CheckCircle2,
    }
  }

  if (run.conclusion === 'failure') {
    return {
      label: 'Failed',
      className: 'status-danger',
      icon: XCircle,
    }
  }

  if (run.status === 'in_progress' || run.status === 'queued') {
    return {
      label: 'Running',
      className: 'status-running',
      icon: RefreshCw,
    }
  }

  return {
    label: run.status || 'Unknown',
    className: 'status-neutral',
    icon: Activity,
  }
}

function Overview() {
  const {
    projects,
    deployments,
    successfulDeployments,
    failedDeployments,
    health,
    loading,
    refreshing,
    refreshAll,
    lastUpdated,
  } = useShipShape()

  const recentDeployments = deployments.slice(0, 8)

  const healthIsGood =
    health?.success === true &&
    health?.status === 'healthy'

  const runningCount = deployments.filter(
    (deployment) =>
      deployment.status === 'in_progress' ||
      deployment.status === 'queued'
  ).length

  return (
    <div className="page-stack">
      <section className="page-header-row">
        <div>
          <div className="eyebrow">
            <Activity size={14} />
            Operations
          </div>

          <h1>Overview</h1>

          <p className="page-description">
            Deployment and delivery activity across your connected
            repositories.
          </p>
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

          {refreshing ? 'Refreshing' : 'Refresh'}
        </button>
      </section>

      <section className="overview-health-banner">
        <div className="health-banner-left">
          <div
            className={`health-indicator ${
              healthIsGood
                ? 'health-indicator-good'
                : 'health-indicator-bad'
            }`}
          >
            <Server size={18} />
          </div>

          <div>
            <strong>
              {healthIsGood
                ? 'ShipShape API operational'
                : 'ShipShape API unavailable'}
            </strong>

            <span>
              {health?.message ||
                'Waiting for backend health information.'}
            </span>
          </div>
        </div>

        <div className="health-banner-meta">
          {lastUpdated
            ? `Updated ${formatRelativeTime(lastUpdated)}`
            : 'Waiting for data'}
        </div>
      </section>

      {errorStateMessage(loading, projects, health) && (
        <div className="inline-warning">
          <CircleAlert size={17} />
          <span>{errorStateMessage(loading, projects, health)}</span>
        </div>
      )}

      <section className="metric-grid">
        <MetricCard
          label="Connected projects"
          value={projects.length}
          icon={Layers3}
        />

        <MetricCard
          label="Deployments"
          value={deployments.length}
          icon={GitBranch}
        />

        <MetricCard
          label="Successful runs"
          value={successfulDeployments.length}
          icon={CheckCircle2}
        />

        <MetricCard
          label="Failed runs"
          value={failedDeployments.length}
          icon={XCircle}
          danger={failedDeployments.length > 0}
        />

        <MetricCard
          label="In progress"
          value={runningCount}
          icon={RefreshCw}
        />
      </section>

      <section className="overview-grid">
        <div className="panel">
          <div className="panel-header">
            <div>
              <span className="panel-kicker">
                Deployment activity
              </span>

              <h2>Recent runs</h2>
            </div>

            <Link
              to="/deployments"
              className="panel-link"
            >
              View all
              <ArrowUpRight size={15} />
            </Link>
          </div>

          {loading ? (
            <LoadingRows />
          ) : recentDeployments.length === 0 ? (
            <EmptyState
              icon={GitBranch}
              title="No deployment activity"
              description="Connect a repository to start tracking GitHub Actions runs."
              action={
                <Link
                  to="/projects"
                  className="button-primary"
                >
                  Connect project
                </Link>
              }
            />
          ) : (
            <div className="deployment-list">
              {recentDeployments.map((deployment) => {
                const status = getRunStatus(deployment)
                const StatusIcon = status.icon

                return (
                  <Link
                    key={`${deployment.projectId}-${deployment.id}`}
                    to={`/deployments/${deployment.id}`}
                    className="deployment-row"
                  >
                    <div className="deployment-row-icon">
                      <StatusIcon size={17} />
                    </div>

                    <div className="deployment-row-main">
                      <strong>
                        {deployment.projectName}
                      </strong>

                      <span>
                        {deployment.name ||
                          'GitHub Actions workflow'}
                      </span>
                    </div>

                    <div className="deployment-row-branch">
                      <GitBranch size={14} />
                      {deployment.head_branch ||
                        deployment.branch ||
                        'unknown'}
                    </div>

                    <div className="deployment-row-time">
                      {formatRelativeTime(
                        deployment.created_at ||
                          deployment.createdAt
                      )}
                    </div>

                    <span
                      className={`status-badge ${status.className}`}
                    >
                      {status.label}
                    </span>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <span className="panel-kicker">
                Workspace
              </span>

              <h2>Projects</h2>
            </div>

            <Link
              to="/projects"
              className="panel-link"
            >
              Manage
              <ArrowUpRight size={15} />
            </Link>
          </div>

          {loading ? (
            <LoadingRows count={4} />
          ) : projects.length === 0 ? (
            <EmptyState
              icon={Layers3}
              title="No projects connected"
              description="Repositories connected to ShipShape will appear here."
              action={
                <Link
                  to="/projects"
                  className="button-primary"
                >
                  Add project
                </Link>
              }
            />
          ) : (
            <div className="project-summary-list">
              {projects.slice(0, 6).map((project) => {
                const projectDeployments =
                  deployments.filter(
                    (deployment) =>
                      deployment.projectId === project.id
                  )

                const latestRun =
                  projectDeployments[0]

                const latestStatus = latestRun
                  ? getRunStatus(latestRun)
                  : null

                return (
                  <Link
                    key={project.id}
                    to={`/projects/${project.id}`}
                    className="project-summary-row"
                  >
                    <div className="project-summary-icon">
                      <GitBranch size={16} />
                    </div>

                    <div className="project-summary-main">
                      <strong>{project.name}</strong>

                      <span>{project.repoUrl}</span>
                    </div>

                    {latestStatus ? (
                      <span
                        className={`status-badge ${latestStatus.className}`}
                      >
                        {latestStatus.label}
                      </span>
                    ) : (
                      <span className="status-badge status-neutral">
                        No runs
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function MetricCard({
  label,
  value,
  icon: Icon,
  danger = false,
}) {
  return (
    <div className="metric-card">
      <div className="metric-card-top">
        <span>{label}</span>

        <div
          className={`metric-icon ${
            danger ? 'metric-icon-danger' : ''
          }`}
        >
          <Icon size={17} />
        </div>
      </div>

      <strong>{value}</strong>
    </div>
  )
}

function LoadingRows({ count = 5 }) {
  return (
    <div className="loading-list">
      {Array.from({ length: count }).map((_, index) => (
        <div
          className="loading-row"
          key={index}
        >
          <div className="loading-block loading-icon" />
          <div className="loading-content">
            <div className="loading-block loading-line" />
            <div className="loading-block loading-line-short" />
          </div>
        </div>
      ))}
    </div>
  )
}

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        <Icon size={20} />
      </div>

      <strong>{title}</strong>

      <p>{description}</p>

      {action}
    </div>
  )
}

function errorStateMessage(
  loading,
  projects,
  health
) {
  if (loading) return null

  if (!health?.success && projects.length === 0) {
    return 'ShipShape could not retrieve operational data. Verify that the backend is running on port 3000.'
  }

  return null
}

export default Overview