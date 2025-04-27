import React, { useEffect, useRef, useState } from 'react';
import { RoughNotation, RoughNotationGroup } from 'react-rough-notation';
import { MoreVertical, Pencil, Trash2 } from 'lucide-react';
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
      <RoughNotationGroup show={true}>
        <RoughNotation
          type="box"
          strokeWidth={2}
          padding={8}
          iterations={2}
          animationDuration={800}
          color="#fbbf24"
        >
          <div className="w-full h-full bg-gray-50/50">
            {/* Empty state */}
            {[...notes, ...snippets].length === 0 && (
              <div className="absolute top-0 left-0 right-0 p-4">
                <div className="text-center text-gray-400">
                  <div className="text-2xl mb-2">📝</div>
                  <p className="font-['Gaegu'] text-lg">Start by highlighting the code to add to your notepad</p>
                </div>
              </div>
            )}
            {/* Render annotations */}
            {[...notes, ...snippets].map((annotation) => {
              if (annotation.filePath !== currentFilePath) return null;
              return (
                <div
                  key={annotation.id}
                  className="absolute w-full"
                  style={{
                    top: `${(annotation.startLine - 1) * lineHeight}px`,
                  }}
                >
                  <div className="px-4">
                    <RoughNotation
                      type="box"
                      strokeWidth={1}
                      padding={4}
                      iterations={1}
                      animationDuration={400}
                      color="#fbbf24"
                    >
                      <div className="bg-white">
                        <div className="flex justify-between items-start gap-2 p-3">
                          <div 
                            className="flex-1 cursor-pointer"
                            onClick={() => onAnnotationClick(annotation)}
                          >
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
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button 
                                className="p-1 hover:bg-gray-100 rounded transition-colors cursor-pointer"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreVertical className="w-4 h-4 text-gray-500" />
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
                    </RoughNotation>
                  </div>
                </div>
              );
            })}
          </div>
        </RoughNotation>
      </RoughNotationGroup>
    </div>
  );
};

export default Notepad; 