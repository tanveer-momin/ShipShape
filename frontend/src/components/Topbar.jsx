import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  Bell,
  CheckCircle2,
  ChevronDown,
  Command,
  RefreshCw,
  Search,
  Server,
  X,
  XCircle,
} from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useShipShape } from '../context/ShipShapeContext'

const pageTitles = {
  '/': 'Overview',
  '/projects': 'Projects',
  '/deployments': 'Deployments',
  '/activity': 'Activity',
  '/services': 'Services',
  '/incidents': 'Incidents',
  '/settings': 'Settings',
}

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

  return `${Math.floor(hours / 24)}d ago`
}

function Topbar() {
  const location = useLocation()

  const {
    health,
    notifications = [],
    refreshing = false,
    refreshAll,
  } = useShipShape()

  const [searchOpen, setSearchOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] =
    useState(false)
  const [healthOpen, setHealthOpen] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')

  const currentPage =
    pageTitles[location.pathname] ||
    (location.pathname.startsWith('/projects/')
      ? 'Project'
      : location.pathname.startsWith('/deployments/')
        ? 'Deployment'
        : 'ShipShape')

  const healthStatus = health?.status || 'checking'

  const healthLabel =
    healthStatus === 'healthy'
      ? 'Operational'
      : healthStatus === 'checking'
        ? 'Checking'
        : 'Unavailable'

  const healthClass =
    healthStatus === 'healthy'
      ? 'health-good'
      : healthStatus === 'checking'
        ? 'health-checking'
        : 'health-error'

  const notificationCount = notifications.length

  useEffect(() => {
    function handleKeyDown(event) {
      const modifierKey =
        event.ctrlKey || event.metaKey

      if (
        modifierKey &&
        event.key.toLowerCase() === 'k'
      ) {
        event.preventDefault()
        setSearchOpen(true)
        setNotificationsOpen(false)
        setHealthOpen(false)
      }

      if (event.key === 'Escape') {
        setSearchOpen(false)
        setNotificationsOpen(false)
        setHealthOpen(false)
      }
    }

    window.addEventListener(
      'keydown',
      handleKeyDown
    )

    return () => {
      window.removeEventListener(
        'keydown',
        handleKeyDown
      )
    }
  }, [])

  useEffect(() => {
    setSearchOpen(false)
    setNotificationsOpen(false)
    setHealthOpen(false)
  }, [location.pathname])

  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    if (!query) {
      return []
    }

    return notifications
      .filter((notification) => {
        const title =
          notification.title?.toLowerCase() || ''

        const description =
          notification.description?.toLowerCase() ||
          ''

        return (
          title.includes(query) ||
          description.includes(query)
        )
      })
      .slice(0, 5)
  }, [notifications, searchQuery])

  function toggleSearch() {
    setSearchOpen((current) => !current)
    setNotificationsOpen(false)
    setHealthOpen(false)
  }

  function toggleNotifications() {
    setNotificationsOpen((current) => !current)
    setSearchOpen(false)
    setHealthOpen(false)
  }

  function toggleHealth() {
    setHealthOpen((current) => !current)
    setSearchOpen(false)
    setNotificationsOpen(false)
  }

  async function handleRefresh() {
    try {
      await refreshAll({ silent: true })
    } catch {
      // The shared context already stores the error state.
    }
  }

  return (
    <header className="topbar">
      <div className="topbar-page">
        <span className="topbar-section">
          Workspace
        </span>

        <span className="topbar-separator">/</span>

        <strong>{currentPage}</strong>
      </div>

      <div className="topbar-actions">
        <button
          className="topbar-action"
          onClick={toggleSearch}
          aria-label="Search"
          aria-expanded={searchOpen}
        >
          <Search size={17} />

          <span className="topbar-action-label">
            Search
          </span>

          <kbd>
            <Command size={10} />
            K
          </kbd>
        </button>

        <button
          className="topbar-icon-button"
          onClick={toggleNotifications}
          aria-label="Notifications"
          aria-expanded={notificationsOpen}
        >
          <Bell size={17} />

          {notificationCount > 0 && (
            <span className="notification-count">
              {notificationCount > 9
                ? '9+'
                : notificationCount}
            </span>
          )}
        </button>

        <button
          className={`topbar-health ${healthClass}`}
          onClick={toggleHealth}
          aria-expanded={healthOpen}
        >
          <span className="health-dot" />
          {healthLabel}
          <ChevronDown size={13} />
        </button>
      </div>

      {searchOpen && (
        <div className="topbar-popover search-popover">
          <div className="popover-search">
            <Search size={16} />

            <input
              autoFocus
              value={searchQuery}
              onChange={(event) =>
                setSearchQuery(event.target.value)
              }
              placeholder="Search operational activity..."
            />

            <button
              className="popover-close"
              onClick={() => {
                setSearchQuery('')
                setSearchOpen(false)
              }}
              aria-label="Close search"
            >
              <X size={15} />
            </button>
          </div>

          {!searchQuery.trim() ? (
            <div className="popover-empty">
              <Search size={19} />

              <strong>
                Search ShipShape
              </strong>

              <span>
                Search recent operational activity,
                deployments and failures.
              </span>
            </div>
          ) : searchResults.length === 0 ? (
            <div className="popover-empty">
              <Search size={19} />

              <strong>
                No matching activity
              </strong>

              <span>
                Nothing matched "{searchQuery}".
              </span>
            </div>
          ) : (
            <div className="popover-list">
              {searchResults.map((notification) => (
                <div
                  className="popover-result"
                  key={notification.id}
                >
                  <div className="popover-result-icon">
                    <XCircle size={16} />
                  </div>

                  <div>
                    <strong>
                      {notification.title}
                    </strong>

                    <span>
                      {notification.description}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {notificationsOpen && (
        <div className="topbar-popover notification-popover">
          <div className="popover-header">
            <div>
              <strong>Notifications</strong>

              <span>
                Recent operational events
              </span>
            </div>

            <button
              className="popover-close"
              onClick={() =>
                setNotificationsOpen(false)
              }
              aria-label="Close notifications"
            >
              <X size={15} />
            </button>
          </div>

          {notifications.length === 0 ? (
            <div className="popover-empty">
              <CheckCircle2 size={20} />

              <strong>
                No active notifications
              </strong>

              <span>
                ShipShape has no recent failed
                deployments to report.
              </span>
            </div>
          ) : (
            <div className="popover-list">
              {notifications.map((notification) => (
                <Link
                  key={notification.id}
                  to={`/deployments/${notification.deployment?.id}`}
                  className="notification-item"
                  onClick={() =>
                    setNotificationsOpen(false)
                  }
                >
                  <div className="notification-icon notification-icon-danger">
                    <XCircle size={16} />
                  </div>

                  <div>
                    <strong>
                      {notification.title}
                    </strong>

                    <span>
                      {notification.description}
                    </span>

                    <small>
                      {formatRelativeTime(
                        notification.createdAt
                      )}
                    </small>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {healthOpen && (
        <div className="topbar-popover health-popover">
          <div className="popover-header">
            <div>
              <strong>
                ShipShape health
              </strong>

              <span>
                API availability
              </span>
            </div>

            <button
              className="popover-close"
              onClick={() =>
                setHealthOpen(false)
              }
              aria-label="Close health"
            >
              <X size={15} />
            </button>
          </div>

          <div className="health-detail">
            <div
              className={`health-detail-icon ${healthClass}`}
            >
              {healthStatus === 'healthy' ? (
                <CheckCircle2 size={19} />
              ) : healthStatus === 'checking' ? (
                <RefreshCw
                  size={19}
                  className="spin"
                />
              ) : (
                <Server size={19} />
              )}
            </div>

            <div>
              <strong>
                {healthLabel}
              </strong>

              <span>
                {health?.message ||
                  'Waiting for the API health check.'}
              </span>
            </div>
          </div>

          <div className="health-popover-footer">
            <span>
              Backend status:{' '}
              <strong>
                {health?.status || 'checking'}
              </strong>
            </span>

            <button
              className="button-secondary"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw
                size={14}
                className={
                  refreshing ? 'spin' : ''
                }
              />

              Refresh
            </button>
          </div>
        </div>
      )}
    </header>
  )
}

export default Topbar