import React, { useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import SegmentedControl from './SegmentedControl';
import Snippets from './ui/notepad/Snippets';
import Notes from './ui/notepad/Notes';

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
      
      {view === 'snippets' ? (
        <Snippets
          notes={notes}
          snippets={snippets}
          currentFilePath={currentFilePath}
          onAnnotationClick={onAnnotationClick}
          onEditNote={onEditNote}
          onDeleteNote={onDeleteNote}
          selectedNoteId={selectedNoteId}
          setSelectedNoteId={setSelectedNoteId}
          view={view}
          isExpanded={isExpanded}
        />
      ) : (
        <Notes isExpanded={isExpanded} />
      )}
    </div>
  );
};

export default Notepad; 