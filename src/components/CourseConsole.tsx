import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { useWalkthrough } from '../context/WalkthroughContext';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { docco } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { getLanguageFromPath } from '../utils/languageDetector';
import { ScrollArea } from './ui/scroll-area';
import { newcourse } from '../lib/mock/newcourse';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { FileContent, useWorkspace } from '../context/WorkspaceContext';
import Lottie from 'lottie-react';
import clockLoading from '../../assets/ClockLoading.json';
import { Checkbox } from './ui/checkbox';

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

// ✅ NEW COMPONENT → Memoized Code Block
const CodeBlock: React.FC<{
  code: string;
  language: string;
  startLine: number;
}> = React.memo(({ code, language, startLine }) => {
  return (
    <ScrollArea className="w-full overflow-x-auto">
      <SyntaxHighlighter
        language={language}
        style={docco}
        customStyle={{
          margin: 0,
          padding: '1rem',
          minWidth: 'fit-content',
          background: '#f8f8f8',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          fontSize: '14px',
          lineHeight: '1.5',
        }}
        showLineNumbers
        startingLineNumber={startLine}
        wrapLines
        wrapLongLines
        useInlineStyles
      >
        {code}
      </SyntaxHighlighter>
    </ScrollArea>
  );
}, (prev, next) => prev.code === next.code && prev.language === next.language && prev.startLine === next.startLine);

const CourseConsole: React.FC = () => {
  const { owner, repo, section } = useParams<{ owner: string; repo: string; section: string }>();
  const navigate = useNavigate();
  const { plan } = useWalkthrough();
  const { fetchFileContent } = useWorkspace();
  const [lessonPlan] = useState<LessonPlan | null>(newcourse);
  const [copyingStates, setCopyingStates] = useState<{ [key: string]: boolean }>({});
  const [fileContents, setFileContents] = useState<{ [key: string]: FileContent }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadedFiles, setLoadedFiles] = useState<Set<string>>(new Set());
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [expandedExplanations, setExpandedExplanations] = useState<Set<string>>(new Set());

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
          console.log('Fetching file:', filePath);
          const fileContent = await fetchFileContent(owner, repo, filePath);
          if (fileContent) {
            newFileContents[filePath] = fileContent;
            newLoadedFiles.add(filePath);
            console.log('Successfully loaded file:', filePath);
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
      <div className="flex-1 overflow-hidden p-6 pt-10">
        <div className="max-w-[95%] mx-auto h-full">
          <div className="space-y-8 h-[calc(100vh-4rem)] overflow-y-auto scroll-smooth snap-y snap-mandatory">
            <div className="snap-start">
              <h1 className="text-4xl font-['Gaegu'] text-black">
                Section 1: {currentSection?.section}
              </h1>
            </div>
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
                    <div className="bg-white rounded-lg shadow-md p-6">
                      <h2 className="text-3xl font-['Gaegu'] text-orange-700">{lesson.title}</h2>
                      <div className="space-y-4">
                        {lesson.steps.map((step, stepIndex) => {
                          const code = getCodeSnippet(step);
                          const stepId = `${lessonIndex}-${stepIndex}`;
                          const shouldShowExpand = step.explanation.length > 3;
                          const isExpanded = expandedExplanations.has(stepId);
                          
                          return (
                            <div key={stepIndex} className="snap-start pt-8">
                              <div className="bg-gray-50 rounded-lg p-6 transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5">
                                <div className="flex items-center justify-between mb-4">
                                  <div className="flex items-center gap-4">
                                    <Checkbox
                                      checked={completedSteps.has(stepId)}
                                      onCheckedChange={() => toggleStep(stepId)}
                                      className="w-6 h-6 border-2 border-orange-500 data-[state=checked]:bg-green-400 data-[state=checked]:border-green-400 transition-all duration-200 hover:border-orange-600 hover:data-[state=checked]:bg-green-500 hover:data-[state=checked]:border-green-500"
                                    />
                                    <h3 className="text-xl font-['Gaegu'] text-orange-600">{step.title}</h3>
                                  </div>
                                  {code && (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <button
                                            onClick={() => handleCopyStep(step, stepId)}
                                            className="flex items-center justify-center w-8 h-8 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors shadow-sm hover:shadow-md border border-orange-700"
                                          >
                                            {copyingStates[stepId] ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                                          </button>
                                        </TooltipTrigger>
                                        <TooltipContent><p>Copy Code</p></TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  )}
                                </div>
                                {code && (
                                  <div className="mb-4 max-h-[calc(100vh-24rem)] overflow-y-auto">
                                    <CodeBlock
                                      code={code}
                                      language={getLanguageFromPath(step.filePath || '')}
                                      startLine={step.startLine || 1}
                                    />
                                  </div>
                                )}
                                <div className="relative">
                                  <div className="text-gray-700 leading-relaxed font-['Gaegu'] text-xl space-y-2 p-4 bg-gray-200 rounded-lg">
                                    {step.explanation.map((exp, i) => (
                                      <li key={i} className={!isExpanded && i >= 3 ? 'hidden' : ''}>
                                        {exp}
                                      </li>
                                    ))}
                                  </div>
                                  {shouldShowExpand && (
                                    <button
                                      onClick={() => toggleExplanation(stepId)}
                                      className="absolute top-2 right-2 p-1 rounded-full hover:bg-gray-300 transition-colors"
                                    >
                                      {isExpanded ? (
                                        <ChevronUp className="w-5 h-5 text-gray-600" />
                                      ) : (
                                        <ChevronDown className="w-5 h-5 text-gray-600" />
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
  );
};

export default CourseConsole;