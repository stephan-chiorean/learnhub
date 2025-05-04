import React, { useState } from 'react';
import { MoreHorizontal, Pencil, Trash2, ChevronRight, ChevronLeft, Maximize2, Minimize2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { ScrollArea } from './ui/scroll-area';
import SegmentedControl from './SegmentedControl';

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

interface NotepadProps {
  notes: Annotation[];
  snippets: Annotation[];
  currentFilePath: string;
  onAnnotationClick: (annotation: Annotation) => void;
  onEditNote: (annotation: Annotation) => void;
  onDeleteNote: (annotation: Annotation) => void;
  onSummaryClick?: (summary: string) => void;
  isExpanded: boolean;
  onExpandChange: (expanded: boolean) => void;
}

const Notepad: React.FC<NotepadProps> = ({
  notes,
  snippets,
  currentFilePath,
  onAnnotationClick,
  onEditNote,
  onDeleteNote,
  onSummaryClick,
  isExpanded,
  onExpandChange,
}) => {
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [view, setView] = useState<'notes' | 'snippets'>('snippets');

  const filteredNotes = [...notes, ...snippets].filter(annotation => 
    annotation.filePath === currentFilePath
  );

  const viewOptions = [
    { label: 'Notes', value: 'notes' },
    { label: 'Snippets', value: 'snippets' }
  ];

  return (
    <div className={`h-full bg-white border-l border-gray-100 shadow-lg transition-all duration-300 w-[800px]`}>
      <div className="flex items-center justify-between p-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onExpandChange(!isExpanded)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            {isExpanded ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
          <h2 className="text-lg font-semibold text-gray-700">Notepad</h2>
        </div>
        <SegmentedControl
          options={viewOptions}
          value={view}
          onChange={(value) => setView(value as 'notes' | 'snippets')}
        />
      </div>
      
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
    </div>
  );
};

export default Notepad; 