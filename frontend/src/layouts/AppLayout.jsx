import { Outlet } from 'react-router-dom'

import Sidebar from '../components/Sidebar'
import Topbar from '../components/Topbar'

function AppLayout() {
  return (
    <div className="app-shell">
      <Sidebar />

      <div className="app-main">
        <Topbar />

        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default AppLayout