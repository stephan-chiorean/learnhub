import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

interface MainContentProps {
  isSidebarOpen: boolean
}

const MainContent: React.FC<MainContentProps> = ({ isSidebarOpen }) => {
  const [repoUrl, setRepoUrl] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleStartLearning = () => {
    // Reset error state
    setError('')

    // Basic URL validation
    if (!repoUrl) {
      setError('Please enter a GitHub repository URL')
      return
    }

    // Parse GitHub URL
    try {
      const url = new URL(repoUrl)
      if (url.hostname !== 'github.com') {
        setError('Please enter a valid GitHub repository URL')
        return
      }

      const pathParts = url.pathname.split('/').filter(Boolean)
      if (pathParts.length < 2) {
        setError('Please enter a valid GitHub repository URL')
        return
      }

      const [owner, repo] = pathParts
      navigate(`/workspace/${owner}/${repo}`)
    } catch (err) {
      setError('Please enter a valid URL')
    }
  }

  return (
    <main className={`main-content ${isSidebarOpen ? 'sidebar-open' : ''} pt-14 min-h-screen bg-gray-50 flex flex-col items-center justify-center w-full`}>
      <div className="flex flex-col items-center justify-center w-full max-w-4xl px-4">
        {/* Walkthrough Logo */}
        <div className="mb-10 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-orange-500">
            <path d="M12 19l7-7 3 3-7 7-3-3z"></path>
            <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path>
            <path d="M2 2l7.586 7.586"></path>
            <circle cx="11" cy="11" r="2"></circle>
          </svg>
          <div className="ml-4 text-4xl font-medium">
            Walk<span className="text-orange-500">through</span>
          </div>
        </div>
        
        {/* Search Input */}
        <div className="search-container w-full">
          <div className="search-input flex items-center w-full px-4 py-3 rounded-full border border-gray-200">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input 
              type="text" 
              placeholder="Paste GitHub repository URL (e.g., https://github.com/owner/repo)" 
              className="w-full text-sm text-gray-700 bg-transparent outline-none"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleStartLearning()}
            />
          </div>
          {error && (
            <div className="mt-2 text-sm text-red-500">
              {error}
            </div>
          )}
        </div>
        
        {/* Start Learning Button */}
        <div className="flex justify-center w-full mt-6">
          <button 
            className="start-button w-fit py-3 px-8 rounded-full text-white font-medium shadow-sm bg-orange-500 hover:bg-orange-600 transition-colors"
            onClick={handleStartLearning}
          >
            Start Learning
          </button>
        </div>
      </div>
    </main>
  )
}

export default MainContent 