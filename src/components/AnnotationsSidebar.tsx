import React, { useState } from 'react';
import { ScrollArea } from './ui/scroll-area';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { X } from 'lucide-react';
import { Tag } from 'antd';

interface Annotation {
  id: string;
  text: string;
  content: string;
  startLine: number;
  endLine: number;
  filePath: string;
  tags?: string[];
}

interface AnnotationsSidebarProps {
  annotations: Annotation[];
  snippets: Annotation[];
  onRemove: (id: string) => void;
  onJumpTo: (filePath: string, startLine: number) => void;
  selectedAnnotationId: string | null;
  onSelectAnnotation: (id: string | null) => void;
  onHighlightLines?: (filePath: string, startLine: number, endLine: number, isActive: boolean) => void;
}

const TABS = ["Notes", "Snippets", "Chat"];

const AnnotationsSidebar: React.FC<AnnotationsSidebarProps> = ({
  annotations,
  snippets,
  onRemove,
  onJumpTo,
  selectedAnnotationId,
  onSelectAnnotation,
  onHighlightLines,
}) => {
  const [activeTab, setActiveTab] = useState<string>('Notes');
  const [chatInput, setChatInput] = useState('');
  const [hoveredSnippetId, setHoveredSnippetId] = useState<string | null>(null);

  const truncateText = (text: string, maxLength: number = 100) => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const handleAnnotationClick = (annotation: Annotation) => {
    onSelectAnnotation(annotation.id);
    onJumpTo(annotation.filePath, annotation.startLine);
    if (onHighlightLines) {
      onHighlightLines(annotation.filePath, annotation.startLine, annotation.endLine, true);
    }
  };

  const handleAnnotationHover = (annotation: Annotation, isHovering: boolean) => {
    if (activeTab === 'Snippets') {
      setHoveredSnippetId(isHovering ? annotation.id : null);
    }
    if (onHighlightLines && selectedAnnotationId !== annotation.id) {
      onHighlightLines(annotation.filePath, annotation.startLine, annotation.endLine, isHovering);
    }
  };

  // Sort annotations and snippets by start line number
  const sortedAnnotations = [...annotations].sort((a, b) => a.startLine - b.startLine);
  const sortedSnippets = [...snippets].sort((a, b) => a.startLine - b.startLine);

  return (
    <div className="w-80 border-l bg-white h-full flex flex-col">
      <div className="px-6 pt-6 pb-3 border-b flex flex-col gap-4">
        <h2 className="text-xl font-semibold mb-1">Workspace</h2>
        <div className="grid grid-cols-3 gap-2">
          {TABS.map(tab => (
            <button
              key={tab}
              className={`w-full px-0 py-2 rounded-t-lg text-base font-medium transition-colors focus:outline-none ${
                activeTab === tab
                  ? 'bg-orange-50 border-b-2 border-orange-500 text-orange-700 shadow-sm'
                  : 'text-gray-500 hover:text-orange-600'
              }`}
              style={{ borderBottom: activeTab === tab ? '2px solid #f97316' : '2px solid transparent' }}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>
      {activeTab === 'Notes' && (
        <ScrollArea className="flex-1">
          <div className="px-6 py-4 space-y-4">
            {sortedAnnotations.length === 0 && (
              <div className="text-gray-400 text-base text-center mt-12">No notes yet.</div>
            )}
            {sortedAnnotations.map((annotation) => (
              <Card 
                key={annotation.id}
                className={`cursor-pointer transition-colors ${
                  selectedAnnotationId === annotation.id 
                    ? 'border-orange-500 bg-orange-50' 
                    : 'hover:bg-gray-50'
                }`}
                onClick={() => handleAnnotationClick(annotation)}
                onMouseEnter={() => handleAnnotationHover(annotation, true)}
                onMouseLeave={() => handleAnnotationHover(annotation, false)}
              >
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2 flex-1">
                      <div className="text-lg font-display text-gray-700 leading-tight">
                        {truncateText(annotation.content)}
                      </div>
                      {annotation.tags && annotation.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {annotation.tags.map((tag) => (
                            <Tag
                              key={tag}
                              className="bg-orange-50 text-orange-700 border-orange-200 text-xs"
                            >
                              {tag}
                            </Tag>
                          ))}
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 mt-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemove(annotation.id);
                      }}
                    >
                      <X className="h-5 w-5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}
      {activeTab === 'Snippets' && (
        <ScrollArea className="flex-1">
          <div className="px-6 py-4 space-y-4">
            {sortedSnippets.length === 0 && (
              <div className="text-gray-400 text-base text-center mt-12">No snippets yet.</div>
            )}
            {sortedSnippets.map((snippet) => (
              <Card 
                key={snippet.id} 
                className={`transition-colors cursor-pointer ${
                  selectedAnnotationId === snippet.id 
                    ? 'border-orange-500 bg-orange-50' 
                    : hoveredSnippetId === snippet.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'hover:bg-gray-50'
                }`}
                onClick={() => handleAnnotationClick(snippet)}
                onMouseEnter={() => handleAnnotationHover(snippet, true)}
                onMouseLeave={() => handleAnnotationHover(snippet, false)}
              >
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2 flex-1">
                      <div className="text-base font-semibold text-orange-700">
                        {truncateText(snippet.text, 40)}
                      </div>
                      <div className="text-sm text-gray-500">
                        {truncateText(snippet.content, 100)}
                      </div>
                      <div className="text-xs text-gray-400">
                        Lines {snippet.startLine}-{snippet.endLine}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 mt-1"
                      onClick={e => {
                        e.stopPropagation();
                        onRemove(snippet.id);
                      }}
                    >
                      <X className="h-5 w-5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}
      {activeTab === 'Chat' && (
        <div className="flex flex-col flex-1 h-full">
          <ScrollArea className="flex-1">
            <div className="px-6 py-4 space-y-4">
              <div className="text-gray-400 text-base text-center mt-12">Chat with your agent coming soon!</div>
            </div>
          </ScrollArea>
          <div className="px-6 py-4 border-t bg-white">
            <form
              onSubmit={e => {
                e.preventDefault();
                setChatInput('');
              }}
              className="flex gap-3"
            >
              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 rounded border border-gray-200 px-4 py-2 text-base focus:outline-none focus:border-orange-400"
                disabled
              />
              <Button type="submit" className="bg-orange-500 text-white px-5" disabled>
                Send
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnnotationsSidebar; 
