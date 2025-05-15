import React, { useState, useEffect, useRef } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Input } from './ui/input';
import { useWorkspace, CodeChunk } from '../context/WorkspaceContext';
import { getFileIcon } from '../utils/fileIcons';
import { Search } from 'lucide-react';
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

  const getItemIcon = (item: SearchableItem) => getFileIcon(item.path, item.type);

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
        className="w-[400px] p-0 shadow-xl border border-blue-200 dark:border-blue-800 rounded-lg bg-blue-50/80 dark:bg-blue-900/20"
        align="start"
        side="top"
        sideOffset={8}
        style={{
          height: '400px',
          overflow: 'hidden',
          zIndex: 50
        }}
      >
        <div className="px-4 pt-3 pb-2 border-b border-blue-200 dark:border-blue-800 bg-blue-50/80 dark:bg-blue-900/20 sticky top-0 z-10">
          <Input
            ref={inputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Add files, folders, docs..."
            className="h-8 text-sm bg-transparent border-0 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-0 placeholder:text-blue-400 dark:placeholder:text-blue-500 text-blue-900 dark:text-blue-100 caret-orange-500 dark:caret-orange-400"
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
              className="w-full px-3 py-2 text-left hover:bg-blue-100/50 dark:hover:bg-blue-800/30 flex items-center gap-2 text-sm border-b border-blue-200/50 dark:border-blue-800/50 last:border-0"
            >
              {getItemIcon(item)}
              <span className="flex-1 flex items-center min-w-0">
                <span className="truncate text-blue-900 dark:text-blue-200 font-medium">
                  {getItemName(item)}
                </span>
                <span className="ml-2 text-xs text-blue-600/70 dark:text-blue-400/70 truncate" style={{ maxWidth: 180 }}>
                  {getItemDisplayPath(item)}
                </span>
              </span>
            </button>
          ))}
          {searchResults.length === 0 && search && (
            <div className="px-3 py-2 text-sm text-blue-700/70 dark:text-blue-300/70">
              No matching files, folders, or functions found
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default ContextPopover; 