import { useCallback, useEffect, useState } from 'react'
import {
  CheckCircle2,
  ExternalLink,
  GitBranch,
  GitCommitHorizontal,
  RefreshCw,
  XCircle,
  LoaderCircle,
  Clock3,
} from 'lucide-react'
import { Link } from 'react-router-dom'

const API_BASE = 'http://localhost:3000'

function formatDate(value) {
  if (!value) return '—'

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function getDuration(start, end) {
  if (!start || !end) return '—'

  const seconds = Math.max(
    0,
    Math.round(
      (new Date(end) - new Date(start)) / 1000
    )
  )

  if (seconds < 60) {
    return `${seconds}s`
  }

  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60

  return `${minutes}m ${remainingSeconds}s`
}

function StatusBadge({ delivery }) {
  if (delivery.state === 'success') {
    return (
      <span className="deployment-status deployment-status-success">
        <CheckCircle2 size={13} />
        Successful
      </span>
    )
  }

  if (delivery.state === 'failed') {
    return (
      <span className="deployment-status deployment-status-failed">
        <XCircle size={13} />
        Failed
      </span>
    )
  }

  if (delivery.state === 'running') {
    return (
      <span className="deployment-status deployment-status-running">
        <LoaderCircle size={13} className="spin" />
        Running
      </span>
    )
  }

  return (
    <span className="deployment-status deployment-status-unknown">
      Unknown
    </span>
  )
}

function Deployments() {
  const [deliveries, setDeliveries] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const loadDeliveries = useCallback(async (isRefresh = false) => {
    try {
      setError('')

      if (isRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      const response = await fetch(
        `${API_BASE}/api/deliveries`
      )

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || 'Could not load deployments'
        )
      }

      setDeliveries(data.deliveries || [])
    } catch (err) {
      console.error('Deployments load error:', err)

      setError(
        err.message || 'Could not load deployments'
      )
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadDeliveries()
  }, [loadDeliveries])

  const successful = deliveries.filter(
    (delivery) => delivery.state === 'success'
  ).length

  const failed = deliveries.filter(
    (delivery) => delivery.state === 'failed'
  ).length

  const running = deliveries.filter(
    (delivery) => delivery.state === 'running'
  ).length

  return (
    <section className="page deployments-page">
      <div className="page-header deployments-header">
        <div>
          <div className="page-kicker">
            DELIVERY
          </div>

          <h1>Deployments</h1>

          <p>
            Delivery runs collected from your connected
            repositories.
          </p>
        </div>

        <button
          type="button"
          className="button-secondary deployments-refresh"
          onClick={() => loadDeliveries(true)}
          disabled={refreshing}
        >
          <RefreshCw
            size={14}
            className={refreshing ? 'spin' : ''}
          />
          {refreshing ? 'Refreshing' : 'Refresh'}
        </button>
      </div>

      <div className="deployment-summary-grid">
        <div className="deployment-summary-card">
          <span>Total runs</span>
          <strong>{deliveries.length}</strong>
        </div>

        <div className="deployment-summary-card">
          <span>Successful</span>
          <strong>{successful}</strong>
        </div>

        <div className="deployment-summary-card">
          <span>Failed</span>
          <strong>{failed}</strong>
        </div>

        <div className="deployment-summary-card">
          <span>Running</span>
          <strong>{running}</strong>
        </div>
      </div>

      {error && (
        <div className="page-alert page-alert-error">
          <XCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      <div className="panel deployments-panel">
        <div className="panel-header">
          <div>
            <h2>DELIVERY RUNS</h2>
            <span>
              GitHub Actions activity from connected repositories
            </span>
          </div>

          <span className="panel-count">
            {deliveries.length} runs
          </span>
        </div>

        {loading ? (
          <div className="page-state">
            <LoaderCircle size={18} className="spin" />
            <span>Loading delivery runs...</span>
          </div>
        ) : deliveries.length === 0 ? (
          <div className="page-state">
            <Clock3 size={20} />
            <strong>No delivery runs yet</strong>
            <span>
              Connect a repository with GitHub Actions to see
              delivery activity here.
            </span>
          </div>
        ) : (
          <div className="deployments-table-wrap">
            <table className="deployments-table">
              <thead>
                <tr>
                  <th>Run</th>
                  <th>Project</th>
                  <th>Branch</th>
                  <th>Commit</th>
                  <th>Status</th>
                  <th>Started</th>
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {deliveries.map((delivery) => (
                  <tr key={delivery.id}>
                    <td>
                      <Link
                        to={`/deployments/${delivery.id}`}
                        className="deployment-run-link"
                      >
                        <span className="deployment-run-name">
                          {delivery.name}
                        </span>

                        <span className="deployment-run-number">
                          #{delivery.runNumber}
                        </span>
                      </Link>
                    </td>

                    <td>
                      <span className="deployment-project">
                        {delivery.projectName}
                      </span>
                    </td>

                    <td>
                      <span className="deployment-meta">
                        <GitBranch size={13} />
                        {delivery.branch || '—'}
                      </span>
                    </td>

                    <td>
                      <span className="deployment-meta deployment-commit">
                        <GitCommitHorizontal size={13} />
                        {delivery.commitShort || '—'}
                      </span>
                    </td>

                    <td>
                      <StatusBadge delivery={delivery} />
                    </td>

                    <td>
                      <span className="deployment-date">
                        {formatDate(delivery.createdAt)}
                      </span>
                    </td>

                    <td>
                      <a
                        href={delivery.url}
                        target="_blank"
                        rel="noreferrer"
                        className="table-icon-button"
                        title="Open GitHub Actions run"
                        aria-label="Open GitHub Actions run"
                      >
                        <ExternalLink size={14} />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}

export default Deployments