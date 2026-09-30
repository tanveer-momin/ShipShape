const API_URL = 'http://localhost:3000/api'

async function request(endpoint, options = {}) {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data.message || `Request failed with ${response.status}`)
  }

  return data
}

export async function getHealth() {
  return request('/health')
}

export async function getProjects() {
  return request('/projects')
}

export async function getRepository(repoUrl) {
  return request(
    `/github/repo?url=${encodeURIComponent(repoUrl)}`
  )
}

export async function getRuns(repoUrl) {
  return request(
    `/github/runs?url=${encodeURIComponent(repoUrl)}`
  )
}

export async function createProject(project) {
  return request('/projects', {
    method: 'POST',
    body: JSON.stringify(project),
  })
}

export async function deleteProject(projectId) {
  return request(`/projects/${encodeURIComponent(projectId)}`, {
    method: 'DELETE',
  })
}

export { API_URL }