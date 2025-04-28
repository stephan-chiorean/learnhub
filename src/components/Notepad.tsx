import React, { useEffect, useRef, useState } from 'react';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';

interface Annotation {
  id: string;
  content: string;
  startLine: number;
  endLine: number;
  filePath: string;
  tags?: string[];
}

interface NotepadProps {
  notes: Annotation[];
  snippets: Annotation[];
  currentFilePath: string;
  onAnnotationClick: (annotation: Annotation) => void;
  onEditNote: (annotation: Annotation) => void;
  onDeleteNote: (annotation: Annotation) => void;
}

const Notepad: React.FC<NotepadProps> = ({
  notes,
  snippets,
  currentFilePath,
  onAnnotationClick,
  onEditNote,
  onDeleteNote,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [lineHeight, setLineHeight] = useState(24); // Default line height in pixels
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);

  useEffect(() => {
    // Get the line height from the code viewer
    const codeLines = document.querySelector('.react-syntax-highlighter-line-number');
    if (codeLines) {
      const computedStyle = window.getComputedStyle(codeLines);
      setLineHeight(parseFloat(computedStyle.lineHeight));
    }
  }, []);

  return (
    <div className="relative h-full" ref={containerRef}>
      {[...notes, ...snippets].length === 0 && (
        <div className="absolute top-0 left-0 right-0 z-[1]">
          <div className="bg-orange-50 border-2 border-orange-200 rounded-lg p-6 mb-4">
            <div className="text-center text-orange-700">
              <div className="text-2xl mb-2">📝</div>
              <p className="font-['Gaegu'] text-lg">Start by highlighting the code to add to your notepad</p>
            </div>
          </div>
        </div>
      )}
      <div 
        className="w-full h-full border-2 border-gray-700 rounded-lg p-4 overflow-hidden"
        style={{
          backgroundImage: `repeating-linear-gradient(
            to bottom,
            #f8fafc,
            #f8fafc ${lineHeight - 1}px,
            #d1d5db ${lineHeight - 1}px,
            #d1d5db ${lineHeight}px
          )`,
          backgroundSize: `100% ${lineHeight}px`
        }}
      >
        {/* Render annotations */}
        {[...notes, ...snippets].map((annotation) => {
          if (annotation.filePath !== currentFilePath) return null;
          return (
            <div
              key={annotation.id}
              className="absolute left-0 right-0"
              style={{
                top: `${(annotation.startLine - 1) * lineHeight}px`,
              }}
            >
              <div className="w-full px-4">
                <div 
                  className={`bg-yellow-50 border-2 rounded-lg transition-colors duration-200 relative cursor-pointer shadow-md hover:shadow-lg transform hover:-rotate-1 ${
                    selectedNoteId === annotation.id 
                      ? 'border-orange-700' 
                      : 'border-yellow-300'
                  }`}
                  onClick={() => {
                    onAnnotationClick(annotation);
                    setSelectedNoteId(annotation.id);
                  }}
                >
                  <div className="flex flex-col gap-2 p-3">
                    <div className="flex-1">
                      <div className="text-lg font-['Gaegu'] text-gray-700 leading-tight">
                        {annotation.content}
                      </div>
                      {annotation.tags && annotation.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {annotation.tags.map((tag: string) => (
                            <span
                              key={tag}
                              className="bg-orange-50 text-orange-700 border border-orange-200 text-xs px-2 py-0.5 rounded"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex justify-end">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button 
                            className="p-1 hover:bg-yellow-100 rounded transition-colors cursor-pointer"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="w-4 h-4 text-gray-500" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditNote(annotation);
                            }}
                            className="cursor-pointer"
                          >
                            <Pencil className="w-4 h-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteNote(annotation);
                            }}
                            className="text-red-600 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Notepad; 