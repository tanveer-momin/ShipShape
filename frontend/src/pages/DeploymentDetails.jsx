import { useParams } from 'react-router-dom'

function DeploymentDetails() {
  const { id } = useParams()

  return (
    <section className="page-placeholder">
      <span>DEPLOYMENT</span>
      <h2>Deployment Details</h2>
      <p>Deployment ID: {id}</p>
    </section>
  )
}

export default DeploymentDetails