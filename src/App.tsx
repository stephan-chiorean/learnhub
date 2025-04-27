import React from 'react'
import Header from './components/Header.tsx'
import Sidebar from './components/Sidebar.tsx'
import MainContent from './components/MainContent.tsx'
import useSidebar from './hooks/useSidebar.ts'

const App: React.FC = () => {
  const { isSidebarOpen, toggleSidebar } = useSidebar()

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar isOpen={isSidebarOpen} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onMenuClick={toggleSidebar} />
        <MainContent isSidebarOpen={isSidebarOpen} />
      </div>
    </div>
  )
}

export default App 