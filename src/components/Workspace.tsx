import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useWorkspace } from '../context/WorkspaceContext'
import SyntaxHighlighter from 'react-syntax-highlighter'
import { docco } from 'react-syntax-highlighter/dist/esm/styles/hljs'

interface WorkspaceProps {
  isSidebarOpen: boolean
}

const Workspace: React.FC<WorkspaceProps> = ({ isSidebarOpen }) => {
  const { owner, repo } = useParams<{ owner: string; repo: string }>()
  const {
    directoryTree,
    currentFile,
    isLoading,
    error,
    fetchDirectoryTree,
    fetchFileContent
  } = useWorkspace()

  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [hasFetched, setHasFetched] = useState(false)

  useEffect(() => {
    if (owner && repo && !hasFetched) {
      fetchDirectoryTree(owner, repo)
      setHasFetched(true)
    }
  }, [owner, repo, fetchDirectoryTree, hasFetched])

  const handleFileClick = (path: string) => {
    if (owner && repo) {
      setSelectedPath(path)
      fetchFileContent(owner, repo, path)
    }
  }

  const renderFileTree = (items: any[]) => {
    return (
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.path}>
            {item.type === 'tree' ? (
              <div className="font-semibold text-gray-700">{item.path.split('/').pop()}</div>
            ) : (
              <button
                onClick={() => handleFileClick(item.path)}
                className={`text-sm hover:text-blue-600 ${
                  selectedPath === item.path ? 'text-blue-600 font-medium' : 'text-gray-600'
                }`}
              >
                {item.path.split('/').pop()}
              </button>
            )}
            {item.children && renderFileTree(item.children)}
          </li>
        ))}
      </ul>
    )
  }

  if (isLoading) {
    return (
      <div className={`flex-1 overflow-auto p-6 ${isSidebarOpen ? 'ml-64' : 'ml-0'}`}>
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
      <div className={`flex-1 overflow-auto p-6 ${isSidebarOpen ? 'ml-64' : 'ml-0'}`}>
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex-1 overflow-auto p-6 ${isSidebarOpen ? 'ml-64' : 'ml-0'}`}>
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">
          {owner}/{repo}
        </h1>
        <div className="grid grid-cols-4 gap-6">
          <div className="col-span-1 bg-white rounded-lg shadow p-4 overflow-auto">
            <h2 className="text-lg font-semibold mb-4">Files</h2>
            {renderFileTree(directoryTree)}
          </div>
          <div className="col-span-3 bg-white rounded-lg shadow p-4 overflow-auto">
            {currentFile ? (
              <div>
                <h2 className="text-lg font-semibold mb-4">{currentFile.path}</h2>
                <SyntaxHighlighter
                  language="javascript"
                  style={docco}
                  customStyle={{ margin: 0, padding: '1rem' }}
                >
                  {currentFile.content}
                </SyntaxHighlighter>
              </div>
            ) : (
              <div className="text-gray-500 text-center py-8">
                Select a file to view its content
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Workspace 