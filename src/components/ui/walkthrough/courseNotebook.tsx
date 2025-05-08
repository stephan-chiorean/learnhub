import React, { useState, useRef, useEffect } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import SegmentedControl from '../../SegmentedControl';
import Notes from '../notepad/Notes';
import { ScrollArea } from '../scroll-area';
import { Progress } from '../progress';

interface ProgressSliderProps {
  totalSteps: number;
  completedSteps: number;
}

export const ProgressSlider: React.FC<ProgressSliderProps> = ({ totalSteps, completedSteps }) => {
  const progress = (completedSteps / totalSteps) * 100;

  return (
    <div className="flex items-center gap-2 w-48">
      <span className="text-sm text-gray-600 font-['Gaegu']">
        Progress
      </span>
      <Progress value={progress} className="h-2" />
    </div>
  );
};

interface CourseNote {
  id: string;
  content: string;
  lessonId: string;
  stepId: string;
  tags?: string[];
}

interface SavedLesson {
  id: string;
  title: string;
  explanation: string[];
  lessonId: string;
  stepId: string;
}

interface CourseNotepadProps {
  notes: CourseNote[];
  lessons: {
    id: string;
    title: string;
    steps: {
      id: string;
      title: string;
      explanation: string[];
    }[];
  }[];
  onEditNote: (note: CourseNote) => void;
  onDeleteNote: (note: CourseNote) => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  initialView?: 'notes' | 'lessons';
  initialLessonId?: string;
  initialStepId?: string;
}

const CourseNotepad: React.FC<CourseNotepadProps> = ({
  notes,
  lessons,
  onEditNote,
  onDeleteNote,
  isOpen,
  onOpenChange,
  initialView = 'notes',
  initialLessonId,
  initialStepId
}) => {
  const [view, setView] = useState<'notes' | 'lessons'>(initialView);
  const [isExpanded, setIsExpanded] = useState(false);
  const [savedLessons, setSavedLessons] = useState<SavedLesson[]>([]);
  const notepadRef = useRef<HTMLDivElement>(null);

  const viewOptions = [
    { label: 'Notes', value: 'notes' },
    { label: 'Lessons', value: 'lessons' }
  ];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const notepadButton = document.querySelector('[aria-label="Open Notepad"]');
      if (notepadRef.current && 
          !notepadRef.current.contains(event.target as Node) && 
          !(notepadButton && notepadButton.contains(event.target as Node))) {
        onOpenChange(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [onOpenChange]);

  useEffect(() => {
    if (isOpen && initialView === 'lessons' && initialLessonId && initialStepId) {
      setView('lessons');
      handleSaveLesson(initialLessonId, initialStepId);
    }
  }, [isOpen, initialView, initialLessonId, initialStepId]);

  const handleSaveLesson = (lessonId: string, stepId: string) => {
    const lesson = lessons.find(l => l.id === lessonId);
    const step = lesson?.steps.find(s => s.id === stepId);
    
    if (lesson && step) {
      const newSavedLesson: SavedLesson = {
        id: `${lessonId}-${stepId}`,
        title: step.title,
        explanation: step.explanation,
        lessonId,
        stepId
      };
      
      setSavedLessons(prev => {
        // Check if lesson is already saved
        const exists = prev.some(l => l.id === newSavedLesson.id);
        if (exists) return prev;
        return [...prev, newSavedLesson];
      });
    }
  };

  return (
    <div 
      ref={notepadRef}
      className={`fixed right-0 top-14 bottom-0 bg-white border-l border-gray-100 shadow-lg transition-all duration-300 ease-in-out transform ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      } ${isExpanded ? 'w-screen max-w-full' : 'w-[800px]'}`}
    >
      <div className="flex items-center justify-between p-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            {isExpanded ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
          <h2 className="text-lg font-semibold text-gray-700">Course Notes</h2>
        </div>
        <SegmentedControl
          options={viewOptions}
          value={view}
          onChange={(value) => setView(value as 'notes' | 'lessons')}
        />
      </div>
      
      <div className="h-[calc(100vh-4rem)] overflow-y-auto">
        {view === 'notes' ? (
          <Notes isExpanded={isExpanded} />
        ) : (
          <ScrollArea className={`h-[calc(100vh-4rem)] ${isExpanded ? 'max-w-[1200px] mx-auto' : ''}`}>
            <div className={`p-4 space-y-4 ${isExpanded ? 'max-w-[1200px] mx-auto' : ''}`}>
              {savedLessons.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[calc(100vh-8rem)] text-gray-400">
                  <div className="text-4xl mb-4">📚</div>
                  <p className="font-['Gaegu'] text-lg">Save lessons to add them to your notepad</p>
                </div>
              ) : (
                savedLessons.map((lesson) => (
                  <div
                    key={lesson.id}
                    className="bg-white border rounded-lg transition-colors duration-200 cursor-pointer shadow-sm hover:shadow-md border-gray-200"
                  >
                    <div className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div className="text-sm text-gray-500">
                          {lessons.find(l => l.id === lesson.lessonId)?.title}
                        </div>
                      </div>
                      <h3 className="text-lg font-semibold text-orange-700 mb-3">
                        {lesson.title}
                      </h3>
                      <div className="text-gray-700 space-y-2">
                        {lesson.explanation.map((exp, index) => (
                          <div key={index} className="flex items-start">
                            <span className="mr-2">•</span>
                            <span>{exp}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
};

export default CourseNotepad;