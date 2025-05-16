import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Copy, Check, ChevronDown, ChevronUp, BookOpen, Share2, BarChart2, Bookmark, MessageSquare, ChevronDown as ChevronDownIcon, Moon, Sun } from 'lucide-react';
import { useWalkthrough } from '../context/WalkthroughContext';
import { useTheme } from '../context/ThemeContext';
import { getLanguageFromPath } from '../utils/languageDetector';
import { newcourse } from '../lib/mock/newcourse';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip';
import { FileContent, useWorkspace } from '../context/WorkspaceContext';
import Lottie from 'lottie-react';
import clockLoading from '../../assets/ClockLoading.json';
import { Checkbox } from '../components/ui/checkbox';
import { CodeBlock } from '../components/ui/walkthrough/code-block';
import CourseNotepad from '../components/ui/walkthrough/courseNotebook';
import { ProgressSlider } from '../components/ui/walkthrough/courseNotebook';
import ChatModal from '../components/ChatModal';
import SectionModal from '../components/ui/walkthrough/section-modal';

export interface LessonStep {
  title: string;
  filePath: string | null;
  startLine: number | null;
  endLine: number | null;
  explanation: string[];
}

export interface Lesson {
  title: string;
  steps: LessonStep[];
}

export interface LessonPlan {
  sectionId: string;
  lessons: Lesson[];
}

interface CourseNote {
  id: string;
  content: string;
  lessonId: string;
  stepId: string;
  tags?: string[];
}

const CourseConsole: React.FC = () => {
  const { owner, repo, section } = useParams<{ owner: string; repo: string; section: string }>();
  const navigate = useNavigate();
  const { plan } = useWalkthrough();
  const { fetchFileContent } = useWorkspace();
  const { mode, toggleTheme } = useTheme();
  const [lessonPlan] = useState<LessonPlan | null>(newcourse);
  const [copyingStates, setCopyingStates] = useState<{ [key: string]: boolean }>({});
  const [fileContents, setFileContents] = useState<{ [key: string]: FileContent }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadedFiles, setLoadedFiles] = useState<Set<string>>(new Set());
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [expandedExplanations, setExpandedExplanations] = useState<Set<string>>(new Set());
  const [showNotepad, setShowNotepad] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isSectionModalOpen, setIsSectionModalOpen] = useState(false);
  const [courseNotes, setCourseNotes] = useState<CourseNote[]>([]);
  const [initialView, setInitialView] = useState<'notes' | 'lessons'>('notes');
  const [selectedLessonId, setSelectedLessonId] = useState<string>();
  const [selectedStepId, setSelectedStepId] = useState<string>();

  const currentSection = plan.find(s => s.sectionId === section);
  const sectionFilePaths = useMemo(() => new Set(currentSection?.files ?? []), [currentSection]);

  const areAllFilesLoaded = useMemo(() => {
    if (!lessonPlan) return false;
    const requiredFiles = new Set<string>();
    lessonPlan.lessons.forEach(lesson => lesson.steps.forEach(step => step.filePath && requiredFiles.add(step.filePath)));
    return Array.from(requiredFiles).every(file => loadedFiles.has(file));
  }, [lessonPlan, loadedFiles]);

  useEffect(() => {
    const fetchSectionFiles = async () => {
      if (!owner || !repo || sectionFilePaths.size === 0) {
        setIsLoading(false);
        return;
      }

      const filesToFetch = Array.from(sectionFilePaths).filter(filePath => !fileContents[filePath]);
      if (filesToFetch.length === 0) return;

      const newFileContents: { [key: string]: FileContent } = {};
      const newLoadedFiles = new Set<string>();

      for (const filePath of filesToFetch) {
        try {
          const fileContent = await fetchFileContent(owner, repo, filePath);
          if (fileContent) {
            newFileContents[filePath] = fileContent;
            newLoadedFiles.add(filePath);
          }
        } catch (error) {
          console.error(`Failed to fetch content for ${filePath}:`, error);
        }
      }

      if (Object.keys(newFileContents).length) {
        setFileContents(prev => ({ ...prev, ...newFileContents }));
        setLoadedFiles(prev => new Set([...prev, ...newLoadedFiles]));
      }
    };

    fetchSectionFiles();
  }, [owner, repo, sectionFilePaths, fetchFileContent]);

  useEffect(() => {
    if (lessonPlan && areAllFilesLoaded && isLoading) setIsLoading(false);
    else if (lessonPlan && !areAllFilesLoaded && !isLoading) setIsLoading(true);
  }, [lessonPlan, areAllFilesLoaded, isLoading]);

  useEffect(() => {
    localStorage.setItem('inCourse', 'true');
    return () => {
      localStorage.removeItem('inCourse');
    };
  }, []);

  const getCodeSnippet = (step: LessonStep) => {
    if (!step.filePath || !step.startLine || !step.endLine) return null;
    
    const fileContent = fileContents[step.filePath];
    if (!fileContent?.content) return null;

    const lines = fileContent.content.split('\n');
    return lines.slice(step.startLine - 1, step.endLine).join('\n');
  };

  const handleCopyStep = async (step: LessonStep, stepId: string) => {
    const code = getCodeSnippet(step);
    if (code) {
      await navigator.clipboard.writeText(code);
      setCopyingStates(prev => ({ ...prev, [stepId]: true }));
      setTimeout(() => setCopyingStates(prev => ({ ...prev, [stepId]: false })), 2000);
    }
  };

  const toggleStep = (stepId: string) => {
    setCompletedSteps(prev => {
      const newSet = new Set(prev);
      if (newSet.has(stepId)) {
        newSet.delete(stepId);
      } else {
        newSet.add(stepId);
      }
      return newSet;
    });
  };

  const toggleExplanation = (stepId: string) => {
    setExpandedExplanations(prev => {
      const newSet = new Set(prev);
      if (newSet.has(stepId)) {
        newSet.delete(stepId);
      } else {
        newSet.add(stepId);
      }
      return newSet;
    });
  };

  const handleEditNote = (note: CourseNote) => {
    // TODO: Implement note editing
    console.log('Edit note:', note);
  };

  const handleDeleteNote = (note: CourseNote) => {
    setCourseNotes(prev => prev.filter(n => n.id !== note.id));
  };

  const handleBookmarkClick = (lessonId: string, stepId: string) => {
    setSelectedLessonId(lessonId);
    setSelectedStepId(stepId);
    setInitialView('lessons');
    setShowNotepad(true);
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="w-32 h-32">
          <Lottie animationData={clockLoading} loop />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <div className="flex-1 overflow-hidden">
        <header className="fixed top-0 left-0 right-0 h-14 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 flex items-center px-4 z-20 shadow-sm">
          <div className="flex items-center gap-8">
            <button
              onClick={() => setIsSectionModalOpen(true)}
              className="group flex items-center gap-2 hover:bg-orange-50 dark:hover:bg-orange-900/20 px-3 py-1.5 rounded-lg transition-colors"
            >
              <h1 className="text-2xl font-display text-black dark:text-white group-hover:text-orange-700 dark:group-hover:text-orange-400">
                Section 1: {currentSection?.section}
              </h1>
              <ChevronDownIcon className="w-5 h-5 text-gray-500 dark:text-gray-400 group-hover:text-orange-700 dark:group-hover:text-orange-400 transition-colors" />
            </button>
            <ProgressSlider 
              totalSteps={lessonPlan?.lessons.reduce((acc, lesson) => acc + lesson.steps.length, 0) || 0}
              completedSteps={completedSteps.size}
            />
          </div>
          
          <div className="flex-1"></div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Toggle theme"
            >
              {mode === 'dark' ? (
                <Sun className="h-5 w-5 text-gray-600 dark:text-gray-300" />
              ) : (
                <Moon className="h-5 w-5 text-gray-600 dark:text-gray-300" />
              )}
            </button>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setIsChatOpen(true)}
                    className="flex items-center justify-center w-10 h-10 bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 rounded-lg hover:bg-orange-200 dark:hover:bg-orange-900/30 transition-colors shadow-sm hover:shadow-md border border-orange-700 dark:border-orange-600"
                    aria-label="Open Chat"
                  >
                    <MessageSquare className="w-5 h-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent><p>Open Chat</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setShowNotepad(!showNotepad)}
                    className="flex items-center justify-center w-10 h-10 bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 rounded-lg hover:bg-orange-200 dark:hover:bg-orange-900/30 transition-colors shadow-sm hover:shadow-md border border-orange-700 dark:border-orange-600"
                    aria-label="Open Notepad"
                  >
                    <BookOpen className="w-5 h-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent><p>Open Notes</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="flex items-center justify-center w-10 h-10 bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 rounded-lg hover:bg-orange-200 dark:hover:bg-orange-900/30 transition-colors shadow-sm hover:shadow-md border border-orange-700 dark:border-orange-600"
                  >
                    <Share2 className="w-5 h-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent><p>Share Progress</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </header>

        <div className="pt-14 p-6">
          <div className="max-w-[95%] mx-auto h-full">
            <div className="space-y-8 h-[calc(100vh-4rem)] overflow-y-auto scroll-smooth snap-y snap-mandatory">
              {!lessonPlan ? (
                <div className="flex items-center justify-center h-32">
                  <div className="w-32 h-32">
                    <Lottie animationData={clockLoading} loop />
                  </div>
                </div>
              ) : (
                <div className="space-y-8">
                  {lessonPlan.lessons.map((lesson, lessonIndex) => (
                    <div key={lessonIndex} className="snap-start pt-4">
                      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                        <h2 className="text-3xl font-display text-orange-700 dark:text-orange-400">{lesson.title}</h2>
                        <div className="space-y-4">
                          {lesson.steps.map((step, stepIndex) => {
                            const code = getCodeSnippet(step);
                            const stepId = `${lessonIndex}-${stepIndex}`;
                            const shouldShowExpand = step.explanation.length > 3;
                            const isExpanded = expandedExplanations.has(stepId);
                            
                            return (
                              <div key={stepIndex} className="snap-start pt-8">
                                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6 transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 group">
                                  <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-4">
                                      <Checkbox
                                        checked={completedSteps.has(stepId)}
                                        onCheckedChange={() => toggleStep(stepId)}
                                        className="w-6 h-6 border-2 border-orange-500 data-[state=checked]:bg-green-400 data-[state=checked]:border-green-400 transition-all duration-200 hover:border-orange-600 hover:data-[state=checked]:bg-green-500 hover:data-[state=checked]:border-green-500"
                                      />
                                      <h3 className="text-xl font-display text-orange-600 dark:text-orange-400">{step.title}</h3>
                                    </div>
                                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                      {code && (
                                        <>
                                          <TooltipProvider>
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <button
                                                  onClick={() => handleBookmarkClick(lessonIndex.toString(), stepId)}
                                                  className="flex items-center justify-center w-7 h-7 bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 rounded-lg hover:bg-orange-200 dark:hover:bg-orange-900/30 transition-colors shadow-sm hover:shadow-md border border-orange-700 dark:border-orange-600"
                                                >
                                                  <Bookmark className="w-3.5 h-3.5" />
                                                </button>
                                              </TooltipTrigger>
                                              <TooltipContent><p>Save to Notepad</p></TooltipContent>
                                            </Tooltip>
                                          </TooltipProvider>

                                          <TooltipProvider>
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <button
                                                  onClick={() => handleCopyStep(step, stepId)}
                                                  className="flex items-center justify-center w-7 h-7 bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 rounded-lg hover:bg-orange-200 dark:hover:bg-orange-900/30 transition-colors shadow-sm hover:shadow-md border border-orange-700 dark:border-orange-600"
                                                >
                                                  {copyingStates[stepId] ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                                                </button>
                                              </TooltipTrigger>
                                              <TooltipContent><p>Copy Code</p></TooltipContent>
                                            </Tooltip>
                                          </TooltipProvider>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                  {code && (
                                    <div className="mb-4 max-h-[calc(100vh-24rem)] overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg">
                                      <CodeBlock
                                        code={code}
                                        language={getLanguageFromPath(step.filePath || '')}
                                        startLine={step.startLine || 1}
                                        filePath={step.filePath || ''}
                                      />
                                    </div>
                                  )}
                                  <div className="relative">
                                    <div className="text-gray-700 dark:text-gray-300 leading-relaxed font-display text-xl space-y-2 p-4 bg-gray-200 dark:bg-gray-600 rounded-lg">
                                      {step.explanation.map((exp, i) => (
                                        <li key={i} className={!isExpanded && i >= 3 ? 'hidden' : ''}>
                                          {exp}
                                        </li>
                                      ))}
                                    </div>
                                    {shouldShowExpand && (
                                      <button
                                        onClick={() => toggleExplanation(stepId)}
                                        className="absolute top-2 right-2 p-1 rounded-full hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                                      >
                                        {isExpanded ? (
                                          <ChevronUp className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                                        ) : (
                                          <ChevronDown className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                                        )}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <CourseNotepad
        notes={courseNotes}
        lessons={lessonPlan?.lessons.map((lesson, index) => ({
          id: index.toString(),
          title: lesson.title,
          steps: lesson.steps.map((step, stepIndex) => ({
            id: `${index}-${stepIndex}`,
            title: step.title,
            explanation: step.explanation
          }))
        })) || []}
        onEditNote={handleEditNote}
        onDeleteNote={handleDeleteNote}
        isOpen={showNotepad}
        onOpenChange={setShowNotepad}
        initialView={initialView}
        initialLessonId={selectedLessonId}
        initialStepId={selectedStepId}
      />
      <ChatModal isOpen={isChatOpen} onOpenChange={setIsChatOpen} />
      <SectionModal 
        isOpen={isSectionModalOpen} 
        onOpenChange={setIsSectionModalOpen}
        currentSection={section || ''}
      />
    </div>
  );
};

export default CourseConsole;