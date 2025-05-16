import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, Minus, ExternalLink } from 'lucide-react';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { solarizedLight, atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../tooltip';
import { useTheme } from '../../../context/ThemeContext';

interface CodeBlockProps {
  code: string;
  language: string;
  startLine: number;
  filePath: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = React.memo(({ code, language, startLine, filePath }) => {
  const [fontSize, setFontSize] = useState(14);
  const { mode } = useTheme();
  const { owner, repo } = useParams<{ owner: string; repo: string }>();
  const navigate = useNavigate();

  const handleZoomIn = () => {
    setFontSize(prev => Math.min(prev + 2, 24));
  };

  const handleZoomOut = () => {
    setFontSize(prev => Math.max(prev - 2, 10));
  };

  const handleNavigateToFile = () => {
    if (owner && repo) {
      navigate(`/workspace/${owner}/${repo}/file?path=${encodeURIComponent(filePath)}`);
    }
  };

  const isDarkMode = mode === 'dark';

  return (
    <div className={`relative rounded-lg border border-gray-300 dark:border-gray-600 ${isDarkMode ? 'bg-[#282c34]' : 'bg-[#f8f8f8]'} overflow-hidden group`}>
      {/* Floating zoom controls */}
      <div className="absolute top-2 right-2 z-10 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleNavigateToFile}
                className="p-1 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors shadow-sm"
                title="Open in file viewer"
              >
                <ExternalLink className="w-4 h-4 text-white" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Open in file viewer</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleZoomOut}
                className="p-1 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors shadow-sm"
                title="Zoom out"
              >
                <Minus className="w-4 h-4 text-white" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Zoom out</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleZoomIn}
                className="p-1 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors shadow-sm"
                title="Zoom in"
              >
                <Plus className="w-4 h-4 text-white" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Zoom in</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Scrollable code area */}
      <div className="max-h-[500px] overflow-auto">
        <SyntaxHighlighter
          language={language}
          style={isDarkMode ? atomOneDark : solarizedLight}
          customStyle={{
            margin: 0,
            padding: '1rem',
            background: isDarkMode ? '#282c34' : '#f8f8f8',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            fontSize: `${fontSize}px`,
            lineHeight: '1.5',
            maxHeight: '500px',
            overflowY: 'auto',
          }}
          showLineNumbers
          startingLineNumber={startLine}
          wrapLines
          wrapLongLines
          useInlineStyles
          lineNumberStyle={{
            color: isDarkMode ? '#636d83' : '#93a1a1',
            minWidth: '2.5em',
            paddingRight: '1em',
            textAlign: 'right',
            userSelect: 'none',
          }}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}, (prev, next) => prev.code === next.code && prev.language === next.language && prev.startLine === next.startLine); 