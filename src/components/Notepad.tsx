import React from 'react';

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
}

const Notepad: React.FC<NotepadProps> = ({
  notes,
  snippets,
  currentFilePath,
  onAnnotationClick,
}) => {
  return (
    <div className="relative h-full">
      <div className="border-2 border-dashed border-orange-200 [border-radius:8px_16px_8px_16px] h-full bg-gray-50/50">
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
              className="absolute w-full p-3 cursor-pointer"
              style={{
                top: `${(annotation.startLine - 1) * 1.5}rem`,
              }}
              onClick={() => onAnnotationClick(annotation)}
            >
              <div className="bg-white p-3 rounded-lg border-2 border-orange-200 shadow-sm hover:shadow-md hover:border-orange-300 transition-all [border-style:dashed] [border-radius:8px_16px_8px_16px]">
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
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Notepad; 