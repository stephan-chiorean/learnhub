import React, { useEffect, useState } from 'react'
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom'
import MainContent from './pages/MainContent'
import CodeViewer from './pages/CodeViewer'
import Walkthrough from './pages/Walkthrough'
import CourseConsole from './pages/CourseConsole'
import Workspace from './components/Workspace'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import useSidebar from './hooks/useSidebar'
import { WorkspaceProvider } from './context/WorkspaceContext'
import { WalkthroughProvider } from './context/WalkthroughContext'

const AppContent: React.FC<{ isSidebarOpen: boolean; toggleSidebar: () => void }> = ({ isSidebarOpen, toggleSidebar }) => {
  const [showHeader, setShowHeader] = useState(true);
  const location = useLocation();

  useEffect(() => {
    const inCourse = localStorage.getItem('inCourse') === 'true';
    setShowHeader(!inCourse);
  }, [location]);

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar isOpen={isSidebarOpen} />
      <div className="flex-1 flex flex-col overflow-hidden">
        {showHeader && <Header onMenuClick={toggleSidebar} />}
        <Routes>
          <Route path="/" element={<MainContent isSidebarOpen={isSidebarOpen} />} />
          <Route path="/workspace/:owner/:repo" element={<Workspace isSidebarOpen={isSidebarOpen} />} />
          <Route path="/workspace/:owner/:repo/file" element={<CodeViewer />} />
          <Route path="/walkthrough/:owner/:repo" element={<Walkthrough />} />
          <Route path="/walkthrough/:owner/:repo/:section" element={<CourseConsole />} />
        </Routes>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const { isSidebarOpen, toggleSidebar } = useSidebar()

  return (
    <WorkspaceProvider>
      <WalkthroughProvider>
        <Router>
          <AppContent isSidebarOpen={isSidebarOpen} toggleSidebar={toggleSidebar} />
        </Router>
      </WalkthroughProvider>
    </WorkspaceProvider>
  )
}

export default App 