import React from 'react';
import { SiPython, SiDocker, SiYaml, SiJavascript, SiTypescript, SiJson, SiMarkdown, SiHtml5, SiCss3, SiReact } from 'react-icons/si';
import { FaFileCode } from 'react-icons/fa';

export const getFileIcon = (fileName: string, type?: 'blob' | 'tree' | 'function') => {
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
  const extension = fileName.split('.').pop()?.toLowerCase();
  if (extension === 'tsx') {
    return <SiReact className="w-4 h-4 text-cyan-500" />;
  }
  switch (extension) {
    case 'py':
      return <SiPython className="w-4 h-4 text-blue-600" />;
    case 'js':
      return <SiJavascript className="w-4 h-4 text-yellow-500" />;
    case 'ts':
      return <SiTypescript className="w-4 h-4 text-blue-600" />;
    case 'yaml':
    case 'yml':
      return <SiYaml className="w-4 h-4 text-red-500" />;
    case 'dockerfile':
    case 'docker-compose.yml':
      return <SiDocker className="w-4 h-4 text-blue-500" />;
    case 'json':
      return <SiJson className="w-4 h-4 text-yellow-600" />;
    case 'md':
    case 'markdown':
      return <SiMarkdown className="w-4 h-4 text-gray-600" />;
    case 'html':
      return <SiHtml5 className="w-4 h-4 text-orange-500" />;
    case 'css':
      return <SiCss3 className="w-4 h-4 text-blue-500" />;
    default:
      return <FaFileCode className="w-4 h-4 text-gray-500" />;
  }
};

export const getFileColor = (fileName: string) => {
  const extension = fileName.split('.').pop()?.toLowerCase();
  
  switch (extension) {
    case 'py':
      return 'text-blue-600';
    case 'js':
      return 'text-yellow-500';
    case 'ts':
      return 'text-blue-600';
    case 'yaml':
    case 'yml':
      return 'text-red-500';
    case 'dockerfile':
    case 'docker-compose.yml':
      return 'text-blue-500';
    case 'json':
      return 'text-yellow-600';
    case 'md':
    case 'markdown':
      return 'text-gray-600';
    case 'html':
      return 'text-orange-500';
    case 'css':
      return 'text-blue-500';
    default:
      return 'text-gray-500';
  }
}; 