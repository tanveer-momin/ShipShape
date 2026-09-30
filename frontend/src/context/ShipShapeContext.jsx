import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import {
  createProject as createProjectApi,
  deleteProject as deleteProjectApi,
  getHealth,
  getProjects,
  getRuns,
} from '../lib/api'

const ShipShapeContext = createContext(null)

export function ShipShapeProvider({ children }) {
  const [projects, setProjects] = useState([])
  const [deployments, setDeployments] = useState([])

  const [health, setHealth] = useState(null)

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)

  async function checkHealth() {
    try {
      const result = await getHealth()
      setHealth(result)
      return result
    } catch (err) {
      setHealth({
        success: false,
        status: 'unhealthy',
        message: 'ShipShape API is unreachable',
      })

      throw err
    }
  }

  async function loadProjects() {
    const result = await getProjects()

    const nextProjects = result.projects || []

    setProjects(nextProjects)

    return nextProjects
  }

  async function loadDeployments(projectList = projects) {
    const deploymentResults = []

    for (const project of projectList) {
      if (!project.repoUrl) continue

      try {
        const result = await getRuns(project.repoUrl)

        const runs = result.runs || []

        runs.forEach((run) => {
          deploymentResults.push({
            ...run,
            projectId: project.id,
            projectName: project.name,
            repoUrl: project.repoUrl,
          })
        })
      } catch (err) {
        console.error(
          `Failed to load runs for ${project.name}:`,
          err
        )
      }
    }

    deploymentResults.sort((a, b) => {
      const dateA = new Date(a.created_at || a.createdAt || 0)
      const dateB = new Date(b.created_at || b.createdAt || 0)

      return dateB - dateA
    })

    setDeployments(deploymentResults)

    return deploymentResults
  }

  async function refreshAll({ silent = false } = {}) {
    if (silent) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    setError(null)

    try {
      const [healthResult, projectList] = await Promise.all([
        checkHealth(),
        loadProjects(),
      ])

      await loadDeployments(projectList)

      setLastUpdated(new Date())

      return {
        health: healthResult,
        projects: projectList,
      }
    } catch (err) {
      console.error('ShipShape refresh failed:', err)

      setError(
        err?.message ||
          'Unable to load ShipShape operational data.'
      )

      throw err
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  async function addProject(project) {
    const result = await createProjectApi(project)

    const createdProject = result.project

    if (createdProject) {
      setProjects((current) => [
        ...current,
        createdProject,
      ])
    }

    return result
  }

  async function removeProject(projectId) {
    await deleteProjectApi(projectId)

    setProjects((current) =>
      current.filter((project) => project.id !== projectId)
    )

    setDeployments((current) =>
      current.filter(
        (deployment) => deployment.projectId !== projectId
      )
    )
  }

  const successfulDeployments = useMemo(
    () =>
      deployments.filter(
        (deployment) =>
          deployment.conclusion === 'success' ||
          deployment.status === 'success'
      ),
    [deployments]
  )

  const failedDeployments = useMemo(
    () =>
      deployments.filter(
        (deployment) =>
          deployment.conclusion === 'failure' ||
          deployment.status === 'failure'
      ),
    [deployments]
  )

  const notifications = useMemo(() => {
    return failedDeployments.slice(0, 5).map((deployment) => ({
      id: deployment.id,
      type: 'failure',
      title: `${deployment.projectName} deployment failed`,
      description:
        deployment.name ||
        'GitHub Actions workflow failed.',
      createdAt:
        deployment.created_at ||
        deployment.createdAt,
      deployment,
    }))
  }, [failedDeployments])

  useEffect(() => {
    refreshAll().catch(() => {})
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      refreshAll({ silent: true }).catch(() => {})
    }, 60000)

    return () => clearInterval(interval)
  }, [])

  const value = {
    projects,
    deployments,
    health,

    loading,
    refreshing,
    error,
    lastUpdated,

    successfulDeployments,
    failedDeployments,
    notifications,

    checkHealth,
    loadProjects,
    loadDeployments,
    refreshAll,

    addProject,
    removeProject,
  }

  return (
    <ShipShapeContext.Provider value={value}>
      {children}
    </ShipShapeContext.Provider>
  )
}

export function useShipShape() {
  const context = useContext(ShipShapeContext)

  if (!context) {
    throw new Error(
      'useShipShape must be used inside ShipShapeProvider'
    )
  }

  return context
}