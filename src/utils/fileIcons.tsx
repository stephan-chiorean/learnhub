import React from 'react';
import { SiPython, SiDocker, SiYaml, SiJavascript, SiTypescript, SiJson, SiMarkdown, SiHtml5, SiCss3 } from 'react-icons/si';
import { FaFileCode } from 'react-icons/fa';

export const getFileIcon = (fileName: string) => {
  const extension = fileName.split('.').pop()?.toLowerCase();
  
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