import React, { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useWorkspace } from '../context/WorkspaceContext'
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Position,
  NodeTypes,
} from 'reactflow'
import 'reactflow/dist/style.css'

interface WorkspaceProps {
  isSidebarOpen: boolean
}

interface FileNodeData {
  label: string
  type: 'file' | 'directory'
  path: string
}

const FileNode: React.FC<{ data: FileNodeData }> = ({ data }) => {
  return (
    <div className={`px-4 py-2 rounded-lg shadow-sm border ${
      data.type === 'directory' 
        ? 'bg-orange-50 border-orange-200' 
        : 'bg-white border-gray-200'
    }`}>
      <div className="flex items-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-4 w-4 mr-2 ${
            data.type === 'directory' ? 'text-orange-500' : 'text-gray-500'
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          {data.type === 'directory' ? (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
            />
          ) : (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          )}
        </svg>
        <span className="text-sm font-medium">{data.label}</span>
      </div>
    </div>
  )
}

const nodeTypes: NodeTypes = {
  fileNode: FileNode,
}

const Workspace: React.FC<WorkspaceProps> = ({ isSidebarOpen }) => {
  const { owner, repo } = useParams<{ owner: string; repo: string }>()
  const navigate = useNavigate()
  const {
    directoryTree,
    isLoading,
    error,
    fetchDirectoryTree,
  } = useWorkspace()

  const [hasFetched, setHasFetched] = useState(false)
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  const processTreeToNodes = useCallback((items: any[], parentId: string | null = null, level: number = 0) => {
    const newNodes: Node[] = []
    const newEdges: Edge[] = []
    let xOffset = 0

    items.forEach((item, index) => {
      const nodeId = item.path
      const isDirectory = item.type === 'tree'
      const node: Node = {
        id: nodeId,
        type: 'fileNode',
        position: { x: level * 250, y: index * 100 },
        data: {
          label: item.path.split('/').pop(),
          type: isDirectory ? 'directory' : 'file',
          path: item.path,
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      }

      newNodes.push(node)

      if (parentId) {
        newEdges.push({
          id: `${parentId}-${nodeId}`,
          source: parentId,
          target: nodeId,
          type: 'smoothstep',
          animated: isDirectory,
        })
      }

      if (item.children) {
        const { nodes: childNodes, edges: childEdges } = processTreeToNodes(
          item.children,
          nodeId,
          level + 1
        )
        newNodes.push(...childNodes)
        newEdges.push(...childEdges)
      }
    })

    return { nodes: newNodes, edges: newEdges }
  }, [])

  useEffect(() => {
    if (owner && repo && !hasFetched) {
      fetchDirectoryTree(owner, repo)
      setHasFetched(true)
    }
  }, [owner, repo, fetchDirectoryTree, hasFetched])

  useEffect(() => {
    if (directoryTree.length > 0) {
      const { nodes: newNodes, edges: newEdges } = processTreeToNodes(directoryTree)
      setNodes(newNodes)
      setEdges(newEdges)
    }
  }, [directoryTree, processTreeToNodes, setNodes, setEdges])

  const onNodeClick = (event: React.MouseEvent, node: Node) => {
    const data = node.data as FileNodeData
    if (data.type === 'file' && owner && repo) {
      navigate(`/workspace/${owner}/${repo}/file?path=${encodeURIComponent(data.path)}`)
    }
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
        <div className="bg-white rounded-lg shadow p-4" style={{ height: 'calc(100vh - 8rem)' }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            fitView
          >
            <Background />
            <Controls />
          </ReactFlow>
        </div>
      </div>
    </div>
  )
}

export default Workspace 