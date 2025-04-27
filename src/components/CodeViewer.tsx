import React from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useWorkspace } from '../context/WorkspaceContext'
import SyntaxHighlighter from 'react-syntax-highlighter'
import { docco } from 'react-syntax-highlighter/dist/esm/styles/hljs'

const CodeViewer: React.FC = () => {
  const { owner, repo } = useParams<{ owner: string; repo: string }>()
  const [searchParams] = useSearchParams()
  const path = searchParams.get('path')
  const { currentFile, isLoading, error, fetchFileContent } = useWorkspace()
  const navigate = useNavigate()

  React.useEffect(() => {
    if (owner && repo && path) {
      const decodedPath = decodeURIComponent(path)
      fetchFileContent(owner, repo, decodedPath)
    }
  }, [owner, repo, searchParams])

  const handleBackClick = () => {
    navigate(`/workspace/${owner}/${repo}`)
  }

  if (isLoading) {
    return (
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="space-y-3">
              <div className="h-4 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center mb-6">
          <button
            onClick={handleBackClick}
            className="flex items-center text-gray-600 hover:text-gray-900 mr-4"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            Back to Workspace
          </button>
          <h1 className="text-2xl font-bold">
            {owner}/{repo}
          </h1>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-lg font-semibold mb-4">{currentFile?.path}</h2>
          <SyntaxHighlighter
            language="javascript"
            style={docco}
            customStyle={{ margin: 0, padding: '1rem' }}
          >
            {currentFile?.content || ''}
          </SyntaxHighlighter>
        </div>
      </div>
    </div>
  )
}

export default CodeViewer 