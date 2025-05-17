import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import axios from 'axios';

export interface Annotation {
  id: string;
  text: string;
  content: string;
  startLine: number;
  endLine: number;
  filePath: string;
}

export interface FileContent {
  content: string;
  path: string;
}

export interface CodeChunk {
  id: string;
  file_path: string;
  file_name: string;
  relative_dir: string;
  extension: string;
  type: string;
  text: string;
  start_line: number;
  end_line: number;
  size: number;
  is_test_file: boolean;
  zone_guess: string;
  function_name: string;
}

export interface ProgressUpdate {
  type: 'init' | 'progress' | 'complete' | 'error';
  stage?: string;
  message?: string;
  progress?: number;
  error?: string;
  data?: any;
}

interface WorkspaceContextType {
  directoryTree: any[];
  currentFile: FileContent | null;
  annotations: Annotation[];
  isLoading: boolean;
  error: string | null;
  namespace: string | null;
  progress: ProgressUpdate | null;
  chunks: CodeChunk[];
  fetchDirectoryTree: (owner: string, repo: string) => Promise<void>;
  fetchFileContent: (owner: string, repo: string, path: string) => Promise<FileContent>;
  fetchChunks: () => Promise<void>;
  addAnnotation: (annotation: Omit<Annotation, 'id'>) => void;
  removeAnnotation: (id: string) => void;
  setNamespace: (namespace: string) => void;
  annotationsMap: Map<string, string>;
  fetchAndSetAnnotation: (directoryPath: string) => Promise<void>;
  clearAnnotations: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export const WorkspaceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [directoryTree, setDirectoryTree] = useState<any[]>([]);
  const [currentFile, setCurrentFile] = useState<FileContent | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [namespace, setNamespaceState] = useState<string | null>(() => {
    // Initialize from localStorage if available
    const savedNamespace = localStorage.getItem('workspaceNamespace');
    return savedNamespace || null;
  });
  const [progress, setProgress] = useState<ProgressUpdate | null>(null);
  const [chunks, setChunks] = useState<CodeChunk[]>([]);
  const [annotationsMap, setAnnotationsMapState] = useState<Map<string, string>>(new Map());

  // Effect to update localStorage when namespace changes
  useEffect(() => {
    if (namespace) {
      localStorage.setItem('workspaceNamespace', namespace);
    }
  }, [namespace]);

  const fetchDirectoryTree = async (owner: string, repo: string) => {
    setIsLoading(true);
    setError(null);
    setProgress(null);

    try {
      const response = await fetch('http://localhost:3001/api/createWorkspace', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ owner, repo }),
      });

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Failed to get response reader');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let workspaceCreated = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              setProgress(data);

              if (data.type === 'complete') {
                setDirectoryTree(data.data.directoryTree);
                const newNamespace = `${owner}_${repo}`;
                setNamespaceState(newNamespace);
                workspaceCreated = true;
              } else if (data.type === 'error') {
                setError(data.error);
              }
            } catch (e) {
              console.error('Failed to parse progress update:', e);
            }
          }
        }
      }

      // Fetch chunks after workspace creation is complete
      if (workspaceCreated) {
        const chunksResponse = await axios.get('http://localhost:3001/api/chunks', {
          params: { namespace: `${owner}_${repo}` }
        });
        setChunks(chunksResponse.data);
      }
    } catch (err) {
      setError('Failed to fetch directory tree');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchFileContent = async (owner: string, repo: string, path: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await axios.get('http://localhost:3001/api/fileContent', {
        params: { owner, repo, path }
      });
      const fileContent = {
        content: response.data.content,
        path
      };
      setCurrentFile(fileContent);
      return fileContent;
    } catch (err) {
      setError('Failed to fetch file content');
      console.error(err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const fetchChunks = async () => {
    if (!namespace) return;
    
    try {
      const response = await axios.get(`http://localhost:3001/api/chunks`, {
        params: { namespace }
      });
      setChunks(response.data);
    } catch (err) {
      console.error('Failed to fetch chunks:', err);
      setError('Failed to fetch code chunks');
    }
  };

  const addAnnotation = (annotation: Omit<Annotation, 'id'>) => {
    const newAnnotation = {
      ...annotation,
      id: Math.random().toString(36).substr(2, 9)
    };
    setAnnotations(prev => [...prev, newAnnotation]);
  };

  const removeAnnotation = (id: string) => {
    setAnnotations(prev => prev.filter(annotation => annotation.id !== id));
  };

  const setNamespace = (namespace: string) => {
    setNamespaceState(namespace);
    localStorage.setItem('workspaceNamespace', namespace);
  };

  const fetchAndSetAnnotation = async (directoryPath: string) => {
    if (annotationsMap.has(directoryPath)) return; // Already fetched
    if (!namespace) return; // Don't fetch if no namespace

    try {
      const response = await fetch('/api/generateAnnotations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          directories: [directoryPath],
          namespace 
        }),
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch annotation for ${directoryPath}`);
      }
      const data = await response.json();
      if (data.annotations && data.annotations[directoryPath]) {
        setAnnotationsMapState(prevMap => new Map(prevMap).set(directoryPath, data.annotations[directoryPath]));
      }
    } catch (err) {
      console.error(`Error fetching annotation for ${directoryPath}:`, err);
      // Optionally set an error state or a placeholder annotation
      setAnnotationsMapState(prevMap => new Map(prevMap).set(directoryPath, "Error fetching annotation."));
    }
  };

  const clearAnnotations = () => {
    setAnnotationsMapState(new Map());
  };

  return (
    <WorkspaceContext.Provider value={{
      directoryTree,
      currentFile,
      annotations,
      isLoading,
      error,
      namespace,
      progress,
      chunks,
      fetchDirectoryTree,
      fetchFileContent,
      fetchChunks,
      addAnnotation,
      removeAnnotation,
      setNamespace,
      annotationsMap,
      fetchAndSetAnnotation,
      clearAnnotations
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}; 