import React, { useState, useEffect, useRef } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Input } from './ui/input';
import { useWorkspace } from '../context/WorkspaceContext';
import { SiOpenai } from 'react-icons/si';
import { getFileIcon } from '../utils/fileIcons';

interface TreeNode {
  name: string;
  path: string;
  type: 'blob' | 'tree';
  children?: TreeNode[];
}

interface ContextPopoverProps {
  onSelect: (path: string, type: 'file' | 'directory') => void;
}

const ContextPopover: React.FC<ContextPopoverProps> = ({ onSelect }) => {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const { directoryTree } = useWorkspace();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const flattenTree = (tree: TreeNode[]): { path: string; type: 'blob' | 'tree' }[] => {
    const result: { path: string; type: 'blob' | 'tree' }[] = [];
    
    const traverse = (node: TreeNode) => {
      result.push({ path: node.path, type: node.type });
      if (node.children) {
        node.children.forEach(traverse);
      }
    };
    
    tree.forEach(traverse);
    return result;
  };

  const filteredFiles = directoryTree
    ? flattenTree(directoryTree)
        .filter(({ path }) => {
          const searchLower = search.toLowerCase();
          const pathLower = path.toLowerCase();
          
          // Split search terms by space for multi-term search
          const terms = searchLower.split(/\s+/).filter(Boolean);
          
          // All terms must match somewhere in the path
          return terms.every(term => pathLower.includes(term));
        })
        .slice(0, 10)
    : [];

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
      <PopoverContent className="w-[400px] p-0" align="start" sideOffset={5}>
        <div className="p-3 border-b">
          <Input
            ref={inputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Add files, folders, docs..."
            className="bg-gray-50 border-0 text-sm placeholder:text-gray-400"
          />
        </div>
        <div className="max-h-[300px] overflow-y-auto py-2">
          {filteredFiles.map(({ path, type }) => (
            <button
              key={path}
              onClick={() => {
                onSelect(path, type === 'blob' ? 'file' : 'directory');
                setIsOpen(false);
                setSearch('');
              }}
              className="w-full px-3 py-2 text-left hover:bg-gray-100 flex items-center gap-2 text-sm"
            >
              {type === 'blob' ? (
                getFileIcon(path)
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 text-orange-500"
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
              )}
              <span className="truncate text-gray-700">{path}</span>
            </button>
          ))}
          {filteredFiles.length === 0 && search && (
            <div className="px-3 py-2 text-sm text-gray-500">
              No matching files or folders found
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default ContextPopover; 