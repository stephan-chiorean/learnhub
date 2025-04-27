import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import MainContent from './components/MainContent'
import Workspace from './components/Workspace'
import CodeViewer from './components/CodeViewer'
import useSidebar from './hooks/useSidebar'
import { WorkspaceProvider } from './context/WorkspaceContext'

const App: React.FC = () => {
  const { isSidebarOpen, toggleSidebar } = useSidebar()

  return (
    <WorkspaceProvider>
      <Router>
        <div className="flex h-screen bg-gray-100">
          <Sidebar isOpen={isSidebarOpen} />
          <div className="flex-1 flex flex-col overflow-hidden">
            <Header onMenuClick={toggleSidebar} />
            <Routes>
              <Route path="/" element={<MainContent isSidebarOpen={isSidebarOpen} />} />
              <Route path="/workspace/:owner/:repo" element={<Workspace isSidebarOpen={isSidebarOpen} />} />
              <Route path="/workspace/:owner/:repo/file" element={<CodeViewer />} />
            </Routes>
          </div>
        </div>
      </Router>
    </WorkspaceProvider>
  )
}

export default App 