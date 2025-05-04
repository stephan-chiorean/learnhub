import React from 'react';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../dropdown-menu';
import { ScrollArea } from '../scroll-area';

interface Annotation {
  id: string;
  content: string;
  fullContent?: string;
  startLine: number;
  endLine: number;
  filePath: string;
  tags?: string[];
  isSummary?: boolean;
  isSnippet?: boolean;
}

interface SnippetsProps {
  notes: Annotation[];
  snippets: Annotation[];
  currentFilePath: string;
  onAnnotationClick: (annotation: Annotation) => void;
  onEditNote: (annotation: Annotation) => void;
  onDeleteNote: (annotation: Annotation) => void;
  selectedNoteId: string | null;
  setSelectedNoteId: (id: string | null) => void;
  view: 'notes' | 'snippets';
  isExpanded: boolean;
}

const Snippets: React.FC<SnippetsProps> = ({
  notes,
  snippets,
  currentFilePath,
  onAnnotationClick,
  onEditNote,
  onDeleteNote,
  selectedNoteId,
  setSelectedNoteId,
  view,
  isExpanded,
}) => {
  const filteredNotes = [...notes, ...snippets].filter(annotation => 
    annotation.filePath === currentFilePath
  );

  return (
    <ScrollArea className={`h-[calc(100vh-4rem)] ${isExpanded ? 'max-w-[1200px] mx-auto' : ''}`}>
      <div className={`p-4 space-y-4 ${isExpanded ? 'max-w-[1200px] mx-auto' : ''}`}>
        {filteredNotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[calc(100vh-8rem)] text-gray-400">
            <div className="text-4xl mb-4">📝</div>
            <p className="font-['Gaegu'] text-lg">Start by highlighting the code to add to your notepad</p>
          </div>
        ) : (
          filteredNotes
            .filter(note => view === 'notes' ? !note.isSnippet : note.isSnippet)
            .map((annotation) => (
              <div
                key={annotation.id}
                className={`bg-white border rounded-lg transition-colors duration-200 cursor-pointer shadow-sm hover:shadow-md ${
                  selectedNoteId === annotation.id ? 'border-orange-500' : 'border-gray-200'
                }`}
                onClick={() => {
                  onAnnotationClick(annotation);
                  setSelectedNoteId(annotation.id);
                }}
              >
                <div className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="text-sm text-gray-500">
                      Lines {annotation.startLine}-{annotation.endLine}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button 
                          className="p-1 hover:bg-gray-100 rounded transition-colors"
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
                  <div className="text-gray-700 mb-3">
                    {annotation.content}
                  </div>
                  {annotation.tags && annotation.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {annotation.tags.map((tag: string) => (
                        <span
                          key={tag}
                          className="text-xs px-2 py-0.5 rounded bg-orange-50 text-orange-700 border border-orange-200"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
        )}
      </div>
    </ScrollArea>
  );
};

export default Snippets; 