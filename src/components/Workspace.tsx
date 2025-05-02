import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react'
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
  Handle,
} from 'reactflow'
import { SiOpenai } from 'react-icons/si'
import 'reactflow/dist/style.css'
import { WalkthroughModal } from './ui/walkthrough'
import ChatModal from './ChatModal'
import { getFileIcon, getFileColor } from '../utils/fileIcons'

interface WorkspaceProps {
  isSidebarOpen: boolean
}

interface FileNodeData {
  label: string
  type: 'file' | 'directory'
  path: string
  isExpanded?: boolean
  children?: any[]
}

const FileNode: React.FC<{ data: FileNodeData }> = ({ data }) => {
  return (
    <div className={`px-4 py-2 rounded-lg shadow-sm border cursor-pointer select-none ${
      data.type === 'directory' 
        ? 'bg-orange-50 border-orange-200 hover:bg-orange-100' 
        : 'bg-white border-gray-200 hover:bg-gray-50'
    }`}>
      <Handle type="target" position={Position.Left} id="target" />
      <div className="flex items-center">
        {data.type === 'directory' ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4 mr-2 flex-shrink-0 text-orange-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
            />
          </svg>
        ) : (
          <div className="mr-2 flex-shrink-0">
            {getFileIcon(data.label)}
          </div>
        )}
        <span className={`text-sm font-medium truncate ${data.type === 'file' ? getFileColor(data.label) : 'text-orange-500'}`}>
          {data.label}
        </span>
      </div>
      <Handle type="source" position={Position.Right} id="source" />
    </div>
  )
}

const nodeTypes: NodeTypes = {
  fileNode: FileNode,
}

const Workspace: React.FC<WorkspaceProps> = ({ isSidebarOpen }) => {
  const { owner, repo } = useParams<{ owner: string; repo: string }>()
  const navigate = useNavigate()
  const { directoryTree, isLoading, error, fetchDirectoryTree } = useWorkspace()
  const [workspaceAlias, setWorkspaceAlias] = useState(`${owner}/${repo}`)
  const [isWalkthroughOpen, setIsWalkthroughOpen] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const hasFetchedRef = useRef(false)

  // Use Maps for efficient node and edge management
  const [nodeMap, setNodeMap] = useState<Map<string, Node>>(new Map())
  const [edgeMap, setEdgeMap] = useState<Map<string, Edge>>(new Map())

  // Convert Maps to arrays for ReactFlow
  const nodes = useMemo(() => Array.from(nodeMap.values()), [nodeMap])
  const edges = useMemo(() => Array.from(edgeMap.values()), [edgeMap])

  // Initialize ReactFlow state with our nodes and edges
  const [reactFlowNodes, setReactFlowNodes, onNodesChange] = useNodesState(nodes)
  const [reactFlowEdges, setReactFlowEdges, onEdgesChange] = useEdgesState(edges)

  // Update ReactFlow state when our nodes or edges change
  useEffect(() => {
    setReactFlowNodes(nodes)
  }, [nodes, setReactFlowNodes])

  useEffect(() => {
    setReactFlowEdges(edges)
  }, [edges, setReactFlowEdges])

  useEffect(() => {
    if (owner && repo && !hasFetchedRef.current && !isLoading) {
      console.log('Fetching directory tree for:', owner, repo)
      fetchDirectoryTree(owner, repo)
      hasFetchedRef.current = true
    }
  }, [owner, repo, fetchDirectoryTree, isLoading])

  const createNode = useCallback((item: any, parentId: string | null, index: number, level: number = 0): Node => {
    const x = level * 300
    const y = index * 100 + (level * 20)

    return {
      id: item.path,
      type: 'fileNode',
      position: { x, y },
      data: {
        label: item.name,
        type: item.type === 'tree' ? 'directory' : 'file',
        path: item.path,
        children: item.children || [],
        isExpanded: false,
      },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      parentNode: parentId || undefined,
      style: {
        width: 200,
        height: 40,
      },
    }
  }, [])

  // Initialize root nodes when directory tree is loaded
  useEffect(() => {
    if (directoryTree && directoryTree.length > 0) {
      const newNodes = new Map<string, Node>()
      const newEdges = new Map<string, Edge>()

      // Only create root-level nodes initially
      directoryTree.forEach((item, index) => {
        const node = createNode(item, null, index)
        newNodes.set(node.id, node)
      })

      setNodeMap(newNodes)
      setEdgeMap(newEdges)
    }
  }, [directoryTree, createNode])

  const toggleFolder = useCallback((node: Node) => {
    const fileData = node.data as FileNodeData
    if (!fileData.children) return

    const alreadyExpanded = fileData.isExpanded

    if (alreadyExpanded) {
      // Collapse folder - remove all descendants
      const newNodes = new Map(nodeMap)
      const newEdges = new Map(edgeMap)
      
      // Efficiently remove all descendants
      const removeDescendants = (parentId: string) => {
        const children = Array.from(newNodes.values()).filter(n => n.parentNode === parentId)
        children.forEach(child => {
          newNodes.delete(child.id)
          newEdges.delete(`${parentId}-${child.id}`)
          if ((child.data as FileNodeData).type === 'directory') {
            removeDescendants(child.id)
          }
        })
      }

      removeDescendants(node.id)
      newNodes.set(node.id, {
        ...node,
        data: { ...fileData, isExpanded: false }
      })

      setNodeMap(newNodes)
      setEdgeMap(newEdges)
    } else {
      // Expand folder - add children
      const newNodes = new Map(nodeMap)
      const newEdges = new Map(edgeMap)

      // Add children nodes and edges
      fileData.children.forEach((child, index) => {
        const childNode = createNode(child, node.id, index, node.position.x / 300 + 1)
        newNodes.set(childNode.id, childNode)
        newEdges.set(`${node.id}-${childNode.id}`, {
          id: `${node.id}-${childNode.id}`,
          source: node.id,
          target: childNode.id,
          type: 'smoothstep',
          animated: true,
          style: { stroke: '#94a3b8' },
        })
      })

      // Update parent node's expanded state
      newNodes.set(node.id, {
        ...node,
        data: { ...fileData, isExpanded: true }
      })

      setNodeMap(newNodes)
      setEdgeMap(newEdges)
    }
  }, [nodeMap, edgeMap, createNode])

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    event.stopPropagation()
    const data = node.data as FileNodeData

    if (data.type === 'directory') {
      toggleFolder(node)
    } else if (data.type === 'file' && owner && repo) {
      navigate(`/workspace/${owner}/${repo}/file?path=${encodeURIComponent(data.path)}`)
    }
  }, [toggleFolder, owner, repo, navigate])

  if (isLoading) {
    return <div className={`flex-1 overflow-auto ${isSidebarOpen ? 'ml-64' : 'ml-0'}`}>Loading...</div>
  }

  if (error) {
    return <div className={`flex-1 overflow-auto ${isSidebarOpen ? 'ml-64' : 'ml-0'}`}>{error}</div>
  }

  return (
    <div className={`flex-1 overflow-auto pt-14 ${isSidebarOpen ? 'ml-64' : 'ml-0'}`}>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between p-6">
          <h1 className="text-2xl font-['Gaegu'] text-orange-700">Code Diagram</h1>
          <input
            type="text"
            value={workspaceAlias}
            onChange={(e) => setWorkspaceAlias(e.target.value)}
            className="text-lg font-semibold text-gray-700 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-orange-500 focus:outline-none px-2 py-1 transition-colors"
            placeholder="Workspace alias"
            size={workspaceAlias.length || 20}
          />
        </div>
        <div className="px-6">
          <div className="bg-white rounded-lg shadow p-4 relative" style={{ height: 'calc(100vh - 14rem)' }}>
            <div className="absolute top-8 right-8 flex items-center gap-4 z-10">
              <button
                onClick={() => setIsChatOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors font-['Gaegu'] text-lg shadow-sm hover:shadow-md"
              >
                Ask AI
                <SiOpenai className="w-5 h-5" />
              </button>
            <button
              onClick={() => setIsWalkthroughOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors font-['Gaegu'] text-lg shadow-sm hover:shadow-md"
            >
              Generate Walkthrough
              <SiOpenai className="w-5 h-5" />
            </button>
            </div>
            <ReactFlow
              nodes={reactFlowNodes}
              edges={reactFlowEdges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={onNodeClick}
              nodeTypes={nodeTypes}
              fitView
              defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
              minZoom={0.1}
              maxZoom={2}
              style={{ background: '#f8fafc' }}
              panOnScroll
              zoomOnScroll={false}
              panOnDrag={false}
            >
              <Background />
              <Controls />
            </ReactFlow>
          </div>
        </div>
      </div>
      <WalkthroughModal
        isOpen={isWalkthroughOpen}
        onOpenChange={setIsWalkthroughOpen}
      />
      <ChatModal
        isOpen={isChatOpen}
        onOpenChange={setIsChatOpen}
      />
    </div>
  )
}

export default Workspace