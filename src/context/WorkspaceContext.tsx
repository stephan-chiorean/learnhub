import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';

export interface Annotation {
  id: string;
  text: string;
  content: string;
  startLine: number;
  endLine: number;
  filePath: string;
}

interface FileContent {
  content: string;
  path: string;
}

interface WorkspaceContextType {
  directoryTree: any[];
  currentFile: FileContent | null;
  annotations: Annotation[];
  isLoading: boolean;
  error: string | null;
  namespace: string | null;
  fetchDirectoryTree: (owner: string, repo: string) => Promise<void>;
  fetchFileContent: (owner: string, repo: string, path: string) => Promise<void>;
  addAnnotation: (annotation: Omit<Annotation, 'id'>) => void;
  removeAnnotation: (id: string) => void;
  setNamespace: (namespace: string) => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export const WorkspaceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [directoryTree, setDirectoryTree] = useState<any[]>([]);
  const [currentFile, setCurrentFile] = useState<FileContent | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [namespace, setNamespaceState] = useState<string | null>(null);

  const fetchDirectoryTree = async (owner: string, repo: string) => {
    setIsLoading(true);
    setError(null);
    try {
      console.log('Making API call to createWorkspace for:', owner, repo);
      const response = await axios.post('http://localhost:3001/api/createWorkspace', {
        owner,
        repo
      });
      setDirectoryTree(response.data.directoryTree);
      setNamespaceState(`${owner}_${repo}`);
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
      setCurrentFile({
        content: response.data.content,
        path
      });
    } catch (err) {
      setError('Failed to fetch file content');
      console.error(err);
    } finally {
      setIsLoading(false);
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
  };

  return (
    <WorkspaceContext.Provider value={{
      directoryTree,
      currentFile,
      annotations,
      isLoading,
      error,
      namespace,
      fetchDirectoryTree,
      fetchFileContent,
      addAnnotation,
      removeAnnotation,
      setNamespace
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