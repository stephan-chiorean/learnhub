import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useWorkspace } from '../context/WorkspaceContext'
import { useTheme } from '../context/ThemeContext'
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
import CourseNotepad from './ui/walkthrough/courseNotebook'
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
        ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 hover:bg-orange-100 dark:hover:bg-orange-900/30'
        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
    }`}>
      {!isRoot && <Handle type="target" position={Position.Top} id="target" />}
      <div className="flex items-center">
        <div className="mr-2 flex-shrink-0">
          {getFileIcon(data.label, data.type === 'directory' ? 'tree' : 'blob')}
        </div>
        <span className={`text-sm font-medium truncate ${data.type === 'file' ? getFileColor(data.label) : 'text-orange-500 dark:text-orange-400'}`}>
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
  const { mode, theme } = useTheme()
  const [workspaceAlias, setWorkspaceAlias] = useState(`${owner}/${repo}`)
  const [isWalkthroughOpen, setIsWalkthroughOpen] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [showNotepad, setShowNotepad] = useState(false)
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
          <h2 className="text-3xl font-display text-orange-700 dark:text-orange-400 mt-4">
            {progress?.message || 'Setting up your Workspace'}
          </h2>
          {typeof progress?.progress === 'number' && (
            <div className="w-64 mt-4">
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                <div 
                  className="bg-orange-600 dark:bg-orange-500 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${progress.progress}%` }}
                />
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 text-center">
                {Math.round(progress.progress)}%
              </p>
            </div>
          )}
          {progress?.stage && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              {progress.stage.charAt(0).toUpperCase() + progress.stage.slice(1)}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (error) return <div className={`flex-1 overflow-auto ${isSidebarOpen ? 'ml-64' : 'ml-0'} dark:text-gray-200`}>{error}</div>;

  return (
    <div className={`flex-1 overflow-auto pt-14 ${isSidebarOpen ? 'ml-64' : 'ml-0'}`}>
      <div className="mx-auto pb-8">
        <div className="flex items-center justify-between p-6">
          <input
            type="text"
            value={workspaceAlias}
            onChange={(e) => setWorkspaceAlias(e.target.value)}
            className="text-lg font-semibold text-gray-700 dark:text-gray-200 bg-transparent border-b border-transparent hover:border-gray-300 dark:hover:border-gray-600 focus:border-orange-500 focus:outline-none px-2 py-1 transition-colors"
            placeholder="Workspace alias"
            size={workspaceAlias.length || 20}
          />
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsWalkthroughOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-200 rounded-lg hover:bg-orange-200 dark:hover:bg-orange-800 transition-colors font-display text-lg shadow-sm hover:shadow-md border border-orange-700 dark:border-orange-600"
            >
              Generate Walkthrough
              <RiSparklingLine className="w-5 h-5" />
            </button>
            <button
              className="flex items-center justify-center w-10 h-10 bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-200 rounded-lg hover:bg-orange-200 dark:hover:bg-orange-800 transition-colors shadow-sm hover:shadow-md border border-orange-700 dark:border-orange-600"
            >
              <RiShareLine className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowNotepad(true)}
              className="flex items-center justify-center w-10 h-10 bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-200 rounded-lg hover:bg-orange-200 dark:hover:bg-orange-800 transition-colors shadow-sm hover:shadow-md border border-orange-700 dark:border-orange-600"
            >
              <PiNotePencilBold className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="px-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 relative" style={{ height: 'calc(100vh - 18rem)' }}>
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
              style={{ background: mode === 'dark' ? theme.colors.gray[800] : theme.colors.gray[100] }}
              panOnScroll
              zoomOnScroll={false}
              panOnDrag={false}
            >
              <Background color={mode === 'dark' ? theme.colors.gray[700] : theme.colors.gray[300]} gap={16} />
            </ReactFlow>
          </div>
          <div className="flex justify-between items-center mt-8 mb-6">
            <h1 className="text-3xl font-display text-orange-700 dark:text-orange-400">Code Explorer</h1>
            <button
              onClick={() => setIsChatOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-200 rounded-lg hover:bg-orange-200 dark:hover:bg-orange-800 transition-colors font-display text-lg shadow-sm hover:shadow-md border border-orange-700 dark:border-orange-600"
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
      <CourseNotepad
        notes={[]}
        lessons={[]}
        onEditNote={() => {}}
        onDeleteNote={() => {}}
        isOpen={showNotepad}
        onOpenChange={setShowNotepad}
        initialView="notes"
      />
    </div>
  );
};

export default Workspace;