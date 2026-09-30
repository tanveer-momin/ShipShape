import { useParams } from 'react-router-dom'

function ProjectDetails() {
  const { id } = useParams()

  return (
    <section className="page-placeholder">
      <span>PROJECT</span>
      <h2>Project Details</h2>
      <p>Project ID: {id}</p>
    </section>
  )
}

export default ProjectDetails