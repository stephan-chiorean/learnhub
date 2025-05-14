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
  NodeProps,
} from 'reactflow'
import { RiSparklingLine, RiShareLine } from 'react-icons/ri'
import { PiNotePencilBold } from 'react-icons/pi'
import { FaComments } from 'react-icons/fa'
import Lottie from 'lottie-react'
import 'reactflow/dist/style.css'
import { WalkthroughModal } from './ui/walkthrough'
import ChatModal from './ChatModal'
import { getFileIcon, getFileColor } from '../utils/fileIcons'
import AtomLoader from '../../assets/AtomLoader.json'
import EqualizerLoader from '../../assets/EqualizerLoader.json'
import ClockLoading from '../../assets/ClockLoading.json'
import LoadingRings from '../../assets/LoadingRings.json'

interface WorkspaceProps {
  isSidebarOpen: boolean
}

interface FileNodeData {
  label: string
  type: 'file' | 'directory'
  path: string
  isExpanded?: boolean
  children?: any[]
  parentPath?: string
}

const FileNode: React.FC<NodeProps<FileNodeData>> = ({ data }) => {
  const isRoot = !data.parentPath;
  return (
    <div className={`px-4 py-2 rounded-lg shadow-sm border cursor-pointer select-none ${
      data.type === 'directory'
        ? 'bg-orange-50 border-orange-200 hover:bg-orange-100'
        : 'bg-white border-gray-200 hover:bg-gray-50'
    }`}>
      {!isRoot && <Handle type="target" position={Position.Top} id="target" />}
      <div className="flex items-center">
        {data.type === 'directory' ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 flex-shrink-0 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
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
      {data.type === 'directory' && <Handle type="source" position={Position.Bottom} id="source" />}
    </div>
  )
}

const nodeTypes: NodeTypes = {
  fileNode: FileNode,
}

const Workspace: React.FC<WorkspaceProps> = ({ isSidebarOpen }) => {
  const { owner, repo } = useParams<{ owner: string; repo: string }>()
  const navigate = useNavigate()
  const { directoryTree, isLoading, error, fetchDirectoryTree, progress } = useWorkspace()
  const [workspaceAlias, setWorkspaceAlias] = useState(`${owner}/${repo}`)
  const [isWalkthroughOpen, setIsWalkthroughOpen] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const hasFetchedRef = useRef(false)

  const [nodeMap, setNodeMap] = useState<Map<string, Node>>(new Map())
  const [edgeMap, setEdgeMap] = useState<Map<string, Edge>>(new Map())

  const nodes = useMemo(() => Array.from(nodeMap.values()), [nodeMap])
  const edges = useMemo(() => Array.from(edgeMap.values()), [edgeMap])

  const [reactFlowNodes, setReactFlowNodes, onNodesChange] = useNodesState(nodes)
  const [reactFlowEdges, setReactFlowEdges, onEdgesChange] = useEdgesState(edges)

  useEffect(() => {
    setReactFlowNodes(nodes)
  }, [nodes, setReactFlowNodes])

  useEffect(() => {
    setReactFlowEdges(edges)
  }, [edges, setReactFlowEdges])

  useEffect(() => {
    if (owner && repo && !hasFetchedRef.current && !isLoading) {
      fetchDirectoryTree(owner, repo)
      hasFetchedRef.current = true
    }
  }, [owner, repo, fetchDirectoryTree, isLoading])

  const NODE_VERTICAL_SPACING = 120;
  const CHILD_HORIZONTAL_SPACING = 300;

  const createNode = useCallback(
    (
      item: any,
      parentId: string | null,
      index: number,
      siblingCount = 1
    ): Node => {
      let x = 0;
      let y = 0;
      let nodeParent: string | undefined = undefined;
      let extent: 'parent' | undefined = undefined;

      if (parentId) {
        // Children: position relative to parent center, use parentNode and extent: 'parent'
        const middleIndex = (siblingCount - 1) / 2;
        x = (index - middleIndex) * CHILD_HORIZONTAL_SPACING;
        y = NODE_VERTICAL_SPACING;
        nodeParent = parentId;
        extent = 'parent';
      } else {
        // Root nodes: global position
        x = index * 250;
        y = 0;
        nodeParent = undefined;
        extent = undefined;
      }

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
          parentPath: parentId,
        },
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
        parentNode: nodeParent,
        extent,
        style: {
          width: 200,
          height: 40,
        },
      };
    },
    []
  );

  useEffect(() => {
    if (directoryTree && directoryTree.length > 0) {
      const newNodes = new Map<string, Node>();
      const newEdges = new Map<string, Edge>();

      directoryTree.forEach((item, index) => {
        const node = createNode(item, null, index, directoryTree.length);
        newNodes.set(node.id, node);
      });

      setNodeMap(newNodes);
      setEdgeMap(newEdges);
    }
  }, [directoryTree, createNode])

  const toggleFolder = useCallback(
    (node: Node) => {
      const fileData = node.data as FileNodeData;
      if (!fileData.children) return;

      const alreadyExpanded = fileData.isExpanded;
      const parentPath = fileData.parentPath;

      const newNodes = new Map(nodeMap);
      const newEdges = new Map(edgeMap);

      // Helper to remove all descendants of a node
      const removeDescendants = (parentId: string) => {
        const children = Array.from(newNodes.values()).filter(n => n.data.parentPath === parentId);
        children.forEach(child => {
          newNodes.delete(child.id);
          newEdges.delete(`${parentId}-${child.id}`);
          if ((child.data as FileNodeData).type === 'directory') {
            removeDescendants(child.id);
          }
        });
      };

      if (alreadyExpanded) {
        // Collapse this node and remove its descendants
        removeDescendants(node.id);
        newNodes.set(node.id, { ...node, data: { ...fileData, isExpanded: false } });
        setNodeMap(newNodes);
        setEdgeMap(newEdges);
      } else {
        // Collapse all siblings at this level and remove their descendants
        Array.from(newNodes.values())
          .filter(n => n.data.parentPath === parentPath && n.id !== node.id && (n.data as FileNodeData).isExpanded)
          .forEach(sibling => {
            removeDescendants(sibling.id);
            newNodes.set(sibling.id, { ...sibling, data: { ...sibling.data, isExpanded: false } });
          });

        // Expand this node and add its children
        const siblingCount = fileData.children.length;
        fileData.children.forEach((child, index) => {
          const childNode = createNode(child, node.id, index, siblingCount);
          newNodes.set(childNode.id, childNode);
          newEdges.set(`${node.id}-${childNode.id}`, {
            id: `${node.id}-${childNode.id}`,
            source: node.id,
            target: childNode.id,
            type: 'smoothstep',
            animated: true,
            style: { stroke: '#f97316' },
          });
        });
        newNodes.set(node.id, { ...node, data: { ...fileData, isExpanded: true } });
        setNodeMap(newNodes);
        setEdgeMap(newEdges);
      }
    },
    [nodeMap, edgeMap, createNode]
  )

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    event.stopPropagation();
    const data = node.data as FileNodeData;

    if (data.type === 'directory') {
      toggleFolder(node);
    } else if (data.type === 'file' && owner && repo) {
      navigate(`/workspace/${owner}/${repo}/file?path=${encodeURIComponent(data.path)}`);
    }
  }, [toggleFolder, owner, repo, navigate]);

  if (isLoading) {
    return (
      <div className={`flex-1 overflow-auto pt-14 ${isSidebarOpen ? 'ml-64' : 'ml-0'}`}>
        <div className="flex flex-col items-center justify-center h-full">
          <div className="w-64 h-64">
            {progress?.stage === 'embedding' ? (
              <Lottie animationData={EqualizerLoader} loop={true} />
            ) : progress?.stage === 'chunking' ? (
              <Lottie animationData={LoadingRings} loop={true} />
            ) : (
              <Lottie animationData={ClockLoading} loop={true} />
            )}
          </div>
          <h2 className="text-3xl font-['Gaegu'] text-orange-700 mt-4">
            {progress?.message || 'Setting up your Workspace'}
          </h2>
          {typeof progress?.progress === 'number' && (
            <div className="w-64 mt-4">
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className="bg-orange-600 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${progress.progress}%` }}
                />
              </div>
              <p className="text-sm text-gray-600 mt-2 text-center">
                {Math.round(progress.progress)}%
              </p>
            </div>
          )}
          {progress?.stage && (
            <p className="text-sm text-gray-500 mt-2">
              {progress.stage.charAt(0).toUpperCase() + progress.stage.slice(1)}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (error) return <div className={`flex-1 overflow-auto ${isSidebarOpen ? 'ml-64' : 'ml-0'}`}>{error}</div>;

  return (
    <div className={`flex-1 overflow-auto pt-14 ${isSidebarOpen ? 'ml-64' : 'ml-0'}`}>
      <div className="mx-auto pb-8">
        <div className="flex items-center justify-between p-6">
        <input
            type="text"
            value={workspaceAlias}
            onChange={(e) => setWorkspaceAlias(e.target.value)}
            className="text-lg font-semibold text-gray-700 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-orange-500 focus:outline-none px-2 py-1 transition-colors"
            placeholder="Workspace alias"
            size={workspaceAlias.length || 20}
          />
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsWalkthroughOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors font-['Gaegu'] text-lg shadow-sm hover:shadow-md border border-orange-700"
            >
              Generate Walkthrough
              <RiSparklingLine className="w-5 h-5" />
            </button>
            <button
              className="flex items-center justify-center w-10 h-10 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors shadow-sm hover:shadow-md border border-orange-700"
            >
              <RiShareLine className="w-5 h-5" />
            </button>
            <button
              className="flex items-center justify-center w-10 h-10 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors shadow-sm hover:shadow-md border border-orange-700"
            >
              <PiNotePencilBold className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="px-6">
          <div className="bg-white rounded-lg shadow p-4 relative" style={{ height: 'calc(100vh - 18rem)' }}>
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
              style={{ background: '#e2e8f0' }}
              panOnScroll
              zoomOnScroll={false}
              panOnDrag={false}
            >
              <Background color="#94a3b8" gap={16} />
              <Controls />
            </ReactFlow>
          </div>
          <div className="flex justify-between items-center mt-8 mb-6">
            <h1 className="text-3xl font-['Gaegu'] text-orange-700">Code Explorer</h1>
            <button
              onClick={() => setIsChatOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors font-['Gaegu'] text-lg shadow-sm hover:shadow-md border border-orange-700"
            >
              Ask AI
              <FaComments className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
      <WalkthroughModal 
        isOpen={isWalkthroughOpen} 
        onOpenChange={setIsWalkthroughOpen}
      />
      <ChatModal isOpen={isChatOpen} onOpenChange={setIsChatOpen} />
    </div>
  );
};

export default Workspace;