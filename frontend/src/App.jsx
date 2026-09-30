import './App.css'

import {
  BrowserRouter,
  Route,
  Routes,
} from 'react-router-dom'

import { ShipShapeProvider } from './context/ShipShapeContext'
import AppLayout from './layouts/AppLayout'

import Activity from './pages/Activity'
import DeploymentDetails from './pages/DeploymentDetails'
import Deployments from './pages/Deployments'
import Incidents from './pages/Incidents'
import Overview from './pages/Overview'
import ProjectDetails from './pages/ProjectDetails'
import Projects from './pages/Projects'
import Services from './pages/Services'
import Settings from './pages/Settings'

function App() {
  return (
    <ShipShapeProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Overview />} />

            <Route
              path="/projects"
              element={<Projects />}
            />

            <Route
              path="/projects/:id"
              element={<ProjectDetails />}
            />

            <Route
              path="/deployments"
              element={<Deployments />}
            />

            <Route
              path="/deployments/:id"
              element={<DeploymentDetails />}
            />

            <Route
              path="/activity"
              element={<Activity />}
            />

            <Route
              path="/services"
              element={<Services />}
            />

            <Route
              path="/incidents"
              element={<Incidents />}
            />

            <Route
              path="/settings"
              element={<Settings />}
            />
          </Route>
        </Routes>
      </BrowserRouter>
    </ShipShapeProvider>
  )
}

export default App