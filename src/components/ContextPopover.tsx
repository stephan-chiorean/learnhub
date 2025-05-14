import React, { useState, useEffect, useRef } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Input } from './ui/input';
import { useWorkspace, CodeChunk } from '../context/WorkspaceContext';
import { SiOpenai } from 'react-icons/si';
import { getFileIcon } from '../utils/fileIcons';
import Fuse from 'fuse.js';

interface TreeNode {
  name: string;
  path: string;
  type: 'blob' | 'tree';
  children?: TreeNode[];
}

interface SearchableItem {
  path: string;
  type: 'blob' | 'tree' | 'function';
  function_name?: string;
  text?: string;
  start_line?: number;
  end_line?: number;
  metadata?: CodeChunk;
}

interface ContextPopoverProps {
  onSelect: (path: string, type: 'blob' | 'tree' | 'function', metadata?: CodeChunk) => void;
}

// Shared icon logic for context
export function getContextIcon(path: string, type: 'blob' | 'tree' | 'function', function_name?: string) {
  if (type === 'tree') {
    // Filled orange folder
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-4 w-4 text-orange-500"
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path d="M2 6a2 2 0 012-2h4l2 2h6a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
      </svg>
    );
  }
  if (type === 'blob') {
    if (path.endsWith('.tsx')) {
      return <SiOpenai className="h-4 w-4 text-cyan-500" />;
    }
    return getFileIcon(path);
  }
  if (type === 'function') {
    // Simple code icon </>
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-4 w-4 text-blue-500"
        fill="none"
        viewBox="0 0 20 20"
        stroke="currentColor"
        strokeWidth={2}
      >
        <polyline points="7 8 3 12 7 16" />
        <polyline points="13 8 17 12 13 16" />
      </svg>
    );
  }
  return getFileIcon(path);
}

const ContextPopover: React.FC<ContextPopoverProps> = ({ onSelect }) => {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const { directoryTree, chunks } = useWorkspace();
  const inputRef = useRef<HTMLInputElement>(null);
  const [searchResults, setSearchResults] = useState<SearchableItem[]>([]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Configure Fuse.js options
  const fuseOptions = {
    keys: [
      { name: 'function_name', weight: 3 }, // Function names are most important
      { name: 'text', weight: 2 },         // Function content is second most important
      { name: 'path', weight: 1 },         // Path is least important
    ],
    threshold: 0.4,
    includeScore: true,
    shouldSort: true,
    findAllMatches: true,
    location: 0,
    distance: 100,
    minMatchCharLength: 2,
    useExtendedSearch: true
  };

  // Helper to flatten the directory tree
  const flattenTree = (tree: TreeNode[]): SearchableItem[] => {
    const result: SearchableItem[] = [];
    const traverse = (node: TreeNode) => {
      result.push({
        path: node.path,
        type: node.type,
        function_name: '',
        text: ''
      });
      if (node.children) node.children.forEach(traverse);
    };
    tree.forEach(traverse);
    return result;
  };

  useEffect(() => {
    // Always show items, even when no search is entered
    const searchableData: SearchableItem[] = [
      // Trees (directories) first
      ...flattenTree(directoryTree || []).filter(item => item.type === 'tree'),
      // Blobs (files) second
      ...flattenTree(directoryTree || []).filter(item => item.type === 'blob'),
      // Functions last, but only those with valid function names
      ...(search ? chunks
        .filter(chunk => chunk.function_name && chunk.function_name.length > 0)
        .map(chunk => ({
          path: chunk.file_path,
          function_name: chunk.function_name,
          text: chunk.text,
          type: 'function' as const,
          start_line: chunk.start_line,
          end_line: chunk.end_line,
          metadata: chunk
        })) : [])
    ];

    if (!search) {
      // When no search, just show the first 10 items
      setSearchResults(searchableData.slice(0, 10));
      return;
    }

    // Split searchable data by type
    const folders = searchableData.filter(item => item.type === 'tree');
    // Files: include all blobs except package.json and package-lock.json
    const files = searchableData.filter(
      item =>
        item.type === 'blob' &&
        !item.path.endsWith('package.json') &&
        !item.path.endsWith('package-lock.json')
    );
    const functions = searchableData.filter(item => item.type === 'function');

    // Run Fuse for each type
    const fuseFolders = new Fuse(folders, fuseOptions);
    const fuseFiles = new Fuse(files, fuseOptions);
    const fuseFunctions = new Fuse(functions, fuseOptions);

    const folderResults = fuseFolders.search(search).map(r => r.item).slice(0, 4);
    const fileResults = fuseFiles.search(search).map(r => r.item).slice(0, 4);
    const functionResults = fuseFunctions.search(search).map(r => r.item).slice(0, 4);

    // Collect already shown
    const shownSet = new Set([
      ...folderResults.map(i => i.path + i.type),
      ...fileResults.map(i => i.path + i.type),
      ...functionResults.map(i => i.path + i.type)
    ]);

    // Best effort matches from all types, excluding already shown
    const fuseAll = new Fuse(searchableData, fuseOptions);
    const allResults = fuseAll.search(search)
      .map(r => r.item)
      .filter(i => !shownSet.has(i.path + i.type));

    // Compose final list
    const finalResults = [
      ...fileResults,
      ...folderResults,
      ...functionResults,
      ...allResults
    ].slice(0, 10);

    setSearchResults(finalResults);
  }, [search, directoryTree, chunks]);

  const getItemIcon = (item: SearchableItem) => getContextIcon(item.path, item.type, item.function_name);

  // Helper to get the display name (last segment)
  const getItemName = (item: SearchableItem) => {
    if (item.type === 'function') {
      return item.function_name || '';
    }
    const segments = item.path.split('/');
    return segments[segments.length - 1];
  };

  // Helper to get the display path (with leading /)
  const getItemDisplayPath = (item: SearchableItem) => {
    if (item.type === 'function') {
      return `${item.path}:${item.start_line}-${item.end_line}`;
    }
    return `/${item.path}`;
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          Add context
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[400px] p-0 shadow-xl border border-gray-200 rounded-lg"
        align="start"
        side="top"
        sideOffset={8}
        style={{
          height: '400px',
          overflow: 'hidden',
          zIndex: 50
        }}
      >
        <div className="px-4 pt-3 pb-2 border-b bg-white sticky top-0 z-10">
          <div className="text-xs text-gray-500 font-semibold mb-1">Add files, folders, docs...</div>
          <Input
            ref={inputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search files, folders, functions..."
            className="bg-gray-50 border-0 text-sm placeholder:text-gray-400"
          />
        </div>
        <div className="overflow-y-auto" style={{ height: 'calc(400px - 60px)' }}>
          {searchResults.map((item, index) => (
            <button
              key={`${item.type}-${item.path}-${index}`}
              onClick={() => {
                onSelect(item.path, item.type, item.metadata);
                setIsOpen(false);
                setSearch('');
              }}
              className="w-full px-3 py-2 text-left hover:bg-gray-100 flex items-center gap-2 text-sm"
            >
              {getItemIcon(item)}
              <span className="flex-1 flex items-center min-w-0">
                <span className="truncate text-gray-800 font-medium">
                  {getItemName(item)}
                </span>
                <span className="ml-2 text-xs text-gray-400 truncate" style={{ maxWidth: 180 }}>
                  {getItemDisplayPath(item)}
                </span>
              </span>
            </button>
          ))}
          {searchResults.length === 0 && search && (
            <div className="px-3 py-2 text-sm text-gray-500">
              No matching files, folders, or functions found
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default ContextPopover; 