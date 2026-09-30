import {
  Activity,
  AlertTriangle,
  Boxes,
  ChevronDown,
  CircleGauge,
  GitBranch,
  Settings,
  ShipWheel,
} from 'lucide-react'

import { useState } from 'react'

import { NavLink } from 'react-router-dom'

const primaryNavigation = [
  {
    label: 'Overview',
    path: '/',
    icon: CircleGauge,
  },
  {
    label: 'Projects',
    path: '/projects',
    icon: Boxes,
  },
  {
    label: 'Deployments',
    path: '/deployments',
    icon: GitBranch,
  },
  {
    label: 'Activity',
    path: '/activity',
    icon: Activity,
  },
]

const operationsNavigation = [
  {
    label: 'Services',
    path: '/services',
    icon: Boxes,
  },
  {
    label: 'Incidents',
    path: '/incidents',
    icon: AlertTriangle,
  },
]

function NavigationItem({ item }) {
  const Icon = item.icon

  return (
    <NavLink
      to={item.path}
      end={item.path === '/'}
      className={({ isActive }) =>
        `sidebar-nav-item ${
          isActive ? 'active' : ''
        }`
      }
    >
      <Icon
        size={17}
        strokeWidth={1.8}
      />

      <span>{item.label}</span>
    </NavLink>
  )
}

function Sidebar() {
  const [workspaceOpen, setWorkspaceOpen] =
    useState(false)

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-mark">
          <ShipWheel
            size={19}
            strokeWidth={2}
          />
        </div>

        <div className="brand-name">
          shipshape<span>.</span>
        </div>
      </div>

      <div className="workspace-container">
        <button
          className="workspace-switcher"
          type="button"
          onClick={() =>
            setWorkspaceOpen(
              (open) => !open
            )
          }
          aria-expanded={workspaceOpen}
        >
          <div className="workspace-avatar">
            T
          </div>

          <div className="workspace-details">
            <strong>
              Tanveer's Workspace
            </strong>
            <span>
              Personal workspace
            </span>
          </div>

          <ChevronDown
            size={15}
            className={
              workspaceOpen
                ? 'rotate-180'
                : ''
            }
          />
        </button>

        {workspaceOpen && (
          <div className="workspace-menu">
            <div className="workspace-menu-label">
              WORKSPACE
            </div>

            <button
              className="workspace-option active"
              type="button"
              onClick={() =>
                setWorkspaceOpen(false)
              }
            >
              <div className="workspace-option-avatar">
                T
              </div>

              <div>
                <strong>
                  Tanveer's Workspace
                </strong>
                <span>
                  Personal workspace
                </span>
              </div>

              <span className="workspace-check">
                ✓
              </span>
            </button>

            <div className="workspace-menu-footer">
              Workspace switching will become
              available when multi-workspace
              support is added.
            </div>
          </div>
        )}
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-label">
          Workspace
        </div>

        <nav className="sidebar-nav">
          {primaryNavigation.map(
            (item) => (
              <NavigationItem
                key={item.path}
                item={item}
              />
            )
          )}
        </nav>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-label">
          Operations
        </div>

        <nav className="sidebar-nav">
          {operationsNavigation.map(
            (item) => (
              <NavigationItem
                key={item.path}
                item={item}
              />
            )
          )}
        </nav>
      </div>

      <div className="sidebar-spacer" />

      <div className="sidebar-section system-section">
        <div className="sidebar-section-label">
          System
        </div>

        <nav className="sidebar-nav">
          <NavigationItem
            item={{
              label: 'Settings',
              path: '/settings',
              icon: Settings,
            }}
          />
        </nav>
      </div>

      <div className="sidebar-user">
        <div className="user-avatar">
          TM
        </div>

        <div className="user-details">
          <strong>
            Tanveer Momin
          </strong>
          <span>
            Workspace owner
          </span>
        </div>
      </div>
    </aside>
  )
}

export default Sidebar