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
  Handle,
} from 'reactflow'
import { SiOpenai } from 'react-icons/si'
import 'reactflow/dist/style.css'

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
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-4 w-4 mr-2 flex-shrink-0 ${
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
        <span className="text-sm font-medium truncate">{data.label}</span>
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

  const [hasFetched, setHasFetched] = useState(false)
  const [nodes, setNodes, onNodesChange] = useNodesState<Node[]>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge[]>([])

  useEffect(() => {
    if (owner && repo && !hasFetched) {
      console.log('Fetching directory tree for:', owner, repo)
      fetchDirectoryTree(owner, repo)
      setHasFetched(true)
    }
  }, [owner, repo, fetchDirectoryTree, hasFetched])

  useEffect(() => {
    if (directoryTree && directoryTree.length > 0) {
      console.log('Processing directory tree:', directoryTree)
      const { nodes: newNodes, edges: newEdges } = processTree(directoryTree)
      console.log('Generated nodes:', newNodes)
      console.log('Generated edges:', newEdges)
      setNodes(newNodes)
      setEdges(newEdges)
    }
  }, [directoryTree])

  const createNode = (item: any, parentId: string | null, index: number, level: number = 0): Node => {
    const x = level * 300;
    const y = index * 100 + (level * 20);

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
    };
  }

  const processTree = (items: any[], parentId: string | null = null, level: number = 0): { nodes: Node[], edges: Edge[] } => {
    let nodes: Node[] = [];
    let edges: Edge[] = [];

    items.forEach((item, index) => {
      const node = createNode(item, parentId, index, level);
      nodes.push(node);

      if (parentId) {
        edges.push({
          id: `${parentId}-${node.id}`,
          source: parentId,
          target: node.id,
          sourceHandle: 'source',
          targetHandle: 'target',
          type: 'smoothstep',
          animated: true,
          style: { stroke: '#94a3b8' },
        });
      }

      if (item.type === 'tree' && item.children && item.children.length > 0) {
        const { nodes: childNodes, edges: childEdges } = processTree(item.children, node.id, level + 1);
        nodes = [...nodes, ...childNodes];
        edges = [...edges, ...childEdges];
      }
    });

    return { nodes, edges };
  }

  const toggleFolder = (node: Node) => {
    const fileData = node.data as FileNodeData
    if (!fileData.children) return

    const alreadyExpanded = fileData.isExpanded

    if (alreadyExpanded) {
      // collapse -> remove all children nodes recursively
      const descendantIds = getAllDescendants(node.id)
      setNodes((nds) => nds.filter((n) => !descendantIds.includes(n.id)))
      setEdges((eds) => eds.filter((e) => !descendantIds.includes(e.source) && !descendantIds.includes(e.target)))
      updateNodeData(node.id, { isExpanded: false })
    } else {
      // expand -> add children nodes
      const childrenNodes = (fileData.children || []).map((child, index) => createNode(child, node.id, index, node.position.x / 300 + 1))
      const childrenEdges = childrenNodes.map((child) => ({
        id: `${node.id}-${child.id}`,
        source: node.id,
        target: child.id,
        type: 'smoothstep',
      }))
      setNodes((nds) => [...nds, ...childrenNodes])
      setEdges((eds) => [...eds, ...childrenEdges])
      updateNodeData(node.id, { isExpanded: true })
    }
  }

  const getAllDescendants = (parentId: string): string[] => {
    const descendants: string[] = []
    const stack = [parentId]

    while (stack.length > 0) {
      const currentId = stack.pop()!
      nodes.forEach((node) => {
        if (node.parentNode === currentId) {
          descendants.push(node.id)
          stack.push(node.id)
        }
      })
    }

    return descendants
  }

  const updateNodeData = (nodeId: string, newData: Partial<FileNodeData>) => {
    setNodes((nds) => nds.map((node) => node.id === nodeId ? { ...node, data: { ...node.data, ...newData } } : node))
  }

  const onNodeClick = (event: React.MouseEvent, node: Node) => {
    event.stopPropagation()
    const data = node.data as FileNodeData

    if (data.type === 'directory') {
      toggleFolder(node)
    } else if (data.type === 'file' && owner && repo) {
      navigate(`/workspace/${owner}/${repo}/file?path=${encodeURIComponent(data.path)}`)
    }
  }

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
            <button
              onClick={() => {/* TODO: Implement walkthrough generation */}}
              className="absolute top-8 right-8 flex items-center gap-2 px-4 py-2 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors font-['Gaegu'] text-lg shadow-sm hover:shadow-md z-10"
            >
              Generate Walkthrough
              <SiOpenai className="w-5 h-5" />
            </button>
            <ReactFlow
              nodes={nodes}
              edges={edges}
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
    </div>
  )
}

export default Workspace