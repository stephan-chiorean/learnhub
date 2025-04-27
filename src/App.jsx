import React from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import MainContent from './components/MainContent';
import useSidebar from './hooks/useSidebar';

function App() {
  const { isOpen, toggleSidebar } = useSidebar();

  return (
    <div className="min-h-screen bg-white w-full">
      <Header onMenuClick={toggleSidebar} />
      <div className="flex w-full">
        <Sidebar isOpen={isOpen} />
        <MainContent isSidebarOpen={isOpen} />
      </div>
    </div>
  );
}

export default App; 