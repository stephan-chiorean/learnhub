import React, { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useWorkspace } from '../context/WorkspaceContext'
import SyntaxHighlighter from 'react-syntax-highlighter'
import { solarizedLight, atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs'
import AnnotationModal from '../components/AnnotationModal'
import Notepad from '../components/Notepad'
import { Copy, Check, ArrowLeft, Sun, Moon, Minus, Plus } from 'lucide-react'
import { SiOpenai } from 'react-icons/si'
import { PiNotePencilBold } from 'react-icons/pi'
import { RiSparklingLine } from 'react-icons/ri'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip'
import AISummaryModal from '../components/AISummaryModal'
import { getLanguageFromPath } from '../utils/languageDetector'
import { ScrollArea } from '../components/ui/scroll-area'
import { useTheme } from '../context/ThemeContext'

const CodeViewer: React.FC = () => {
  const { owner, repo } = useParams<{ owner: string; repo: string }>()
  const [searchParams] = useSearchParams()
  const path = searchParams.get('path')
  const { currentFile, isLoading, error, fetchFileContent, annotations, addAnnotation, removeAnnotation } = useWorkspace()
  const navigate = useNavigate()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selection, setSelection] = useState<{
    text: string
    startLine: number
    endLine: number
    filePath: string
  } | null>(null)
  const [editingNote, setEditingNote] = useState<any>(null)
  const codeRef = useRef<HTMLDivElement>(null)
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null)
  const [notes, setNotes] = useState<any[]>([])
  const [snippets, setSnippets] = useState<any[]>([])
  const [hoveredAnnotation, setHoveredAnnotation] = useState<{filePath: string, startLine: number, endLine: number} | null>(null)
  const [clickedAnnotation, setClickedAnnotation] = useState<{filePath: string, startLine: number, endLine: number} | null>(null)
  const [isAISummaryOpen, setIsAISummaryOpen] = useState(false)
  const [isCopying, setIsCopying] = useState(false)
  const [aiSummary, setAISummary] = useState<string | SummaryJSON>('')
  const [loadingDots, setLoadingDots] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isNotepadOpen, setIsNotepadOpen] = useState(false)
  const notepadRef = useRef<HTMLDivElement>(null)
  const { mode } = useTheme();
  const [fontSize, setFontSize] = useState(14);

  interface SummaryJSON {
    title: string
    mainPurpose: string
    keyComponents: {
      name: string
      description: string
    }[]
    overallStructure: string
  }

  useEffect(() => {
    console.log('Current path:', path);
    console.log('Current file path:', currentFile?.path);
  }, [path, currentFile]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (typeof aiSummary === 'string' && aiSummary.startsWith('Generating summary')) {
      interval = setInterval(() => {
        setLoadingDots(prev => {
          const newDots = prev.length >= 3 ? '' : prev + '.';
          setAISummary('Generating summary' + newDots);
          return newDots;
        });
      }, 200);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [aiSummary]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const notepadButton = document.querySelector('[aria-label="Open Notepad"]');
      if (notepadRef.current && 
          !notepadRef.current.contains(event.target as Node) && 
          !(notepadButton && notepadButton.contains(event.target as Node))) {
        setIsNotepadOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  React.useEffect(() => {
    if (owner && repo && path) {
      const decodedPath = decodeURIComponent(path)
      fetchFileContent(owner, repo, decodedPath)
    }
  }, [owner, repo, path])

  const handleBackClick = () => {
    navigate(`/workspace/${owner}/${repo}`)
  }

  const handleTextSelection = () => {
    const selection = window.getSelection()
    if (!selection || !selection.toString().trim()) return

    const range = selection.getRangeAt(0)
    const preSelectionRange = range.cloneRange()
    preSelectionRange.selectNodeContents(codeRef.current!)
    preSelectionRange.setEnd(range.startContainer, range.startOffset)
    const start = preSelectionRange.toString().split('\n').length - 1
    const end = start + selection.toString().split('\n').length - 1

    // Get the actual code content without line numbers
    const codeLines = currentFile?.content.split('\n') || []
    const selectedLines = codeLines.slice(start, end + 1)
    
    // Remove any line numbers that might be in the selection
    const cleanedLines = selectedLines.map(line => {
      // Remove any leading numbers and spaces
      return line.replace(/^\s*\d+\s*/, '')
    })
    
    const selectedText = cleanedLines.join('\n')

    setSelection({
      text: selectedText,
      startLine: start + 1,
      endLine: end + 1,
      filePath: path || '',
    })
    setIsModalOpen(true)
  }

  const handleSaveAnnotation = (data: any) => {
    if (!selection) return;
    
    console.log('Saving annotation with data:', data);
    console.log('Current selection:', selection);
    
    const newNote = {
      id: `${Date.now()}-note`,
      content: data.content,
      startLine: selection.startLine,
      endLine: selection.endLine,
      filePath: selection.filePath,
      tags: data.tags || [],
      isSummary: false,
      isSnippet: true
    };
    
    setSnippets(prev => {
      const updatedNotes = [newNote, ...prev];
      console.log('Updated notes array:', updatedNotes);
      return updatedNotes;
    });
    
    setIsModalOpen(false);
    setSelection(null);
    setIsNotepadOpen(true);
  };

  // Add useEffect to monitor notes state
  useEffect(() => {
    console.log('Current notes state:', notes);
  }, [notes]);

  const handleJumpTo = (filePath: string, startLine: number) => {
    navigate(`/workspace/${owner}/${repo}/file?path=${encodeURIComponent(filePath)}#L${startLine}`)
  }

  const handleHighlightLines = (filePath: string, startLine: number, endLine: number, isActive: boolean) => {
    if (isActive) {
      setHoveredAnnotation({ filePath, startLine, endLine })
    } else {
      setHoveredAnnotation(null)
    }
  }

  const handleAnnotationClick = (annotation: any) => {
    setClickedAnnotation({
      filePath: annotation.filePath,
      startLine: annotation.startLine,
      endLine: annotation.endLine
    });
    setSelectedAnnotationId(annotation.id);
  };

  const handleEditNote = (annotation: any) => {
    setEditingNote(annotation);
    setSelection({
      text: annotation.text,
      startLine: annotation.startLine,
      endLine: annotation.endLine,
      filePath: annotation.filePath,
    });
    setIsModalOpen(true);
  };

  const handleDeleteNote = (annotation: any) => {
    setNotes(prev => prev.filter(note => note.id !== annotation.id));
    setSnippets(prev => prev.filter(snippet => snippet.id !== annotation.id));
  };

  const getHighlightedLines = (): { lines: number[]; selectedLines: number[]; hoveredLines: number[]; clickedLines: number[] } => {
    if (!path) return { lines: [], selectedLines: [], hoveredLines: [], clickedLines: [] };
    
    // Get all annotations for the current file
    const fileAnnotations = [...notes, ...snippets].filter(a => a.filePath === path);
    const highlightedLines = new Set<number>();
    
    // Get the selected annotation
    const selectedAnnotation = selectedAnnotationId 
      ? [...notes, ...snippets].find(a => a.id === selectedAnnotationId)
      : null;
    
    // Add all lines from all annotations to the highlighted set
    fileAnnotations.forEach(annotation => {
      for (let i = annotation.startLine; i <= annotation.endLine; i++) {
        highlightedLines.add(i);
      }
    });
    
    // Get hovered lines if they're for the current file
    const hoveredLines = hoveredAnnotation && hoveredAnnotation.filePath === path
      ? Array.from({ length: hoveredAnnotation.endLine - hoveredAnnotation.startLine + 1 }, 
          (_, i) => hoveredAnnotation.startLine + i)
      : [];

    // Get clicked lines if they're for the current file
    const clickedLines = clickedAnnotation && clickedAnnotation.filePath === path
      ? Array.from({ length: clickedAnnotation.endLine - clickedAnnotation.startLine + 1 }, 
          (_, i) => clickedAnnotation.startLine + i)
      : [];
    
    return {
      lines: Array.from(highlightedLines),
      selectedLines: selectedAnnotation 
        ? Array.from({ length: selectedAnnotation.endLine - selectedAnnotation.startLine + 1 }, 
            (_, i) => selectedAnnotation.startLine + i)
        : [],
      hoveredLines,
      clickedLines
    };
  };

  const handleCopyFile = async () => {
    if (currentFile?.content) {
      await navigator.clipboard.writeText(currentFile.content)
      setIsCopying(true)
      setTimeout(() => setIsCopying(false), 2000)
    }
  }

  const handleAISummary = async () => {
    if (!currentFile?.content) return;
    setIsAISummaryOpen(true);
    setLoadingDots('');
    setAISummary('Generating summary');
    setIsGenerating(true);

    try {
      const response = await fetch('http://localhost:3001/api/generateSummary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: currentFile.content
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate summary');
      }

      const data = await response.json();
      // Ensure we're setting the summary correctly
      if (typeof data.summary === 'string') {
        setAISummary(data.summary);
      } else if (data.summary && typeof data.summary === 'object') {
        setAISummary(data.summary);
      } else {
        throw new Error('Invalid summary format received');
      }
    } catch (error) {
      console.error('Error generating summary:', error);
      setAISummary('Failed to generate summary. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddSummaryNote = () => {
    let noteContent = '';
    let fullContent = '';
    
    if (typeof aiSummary === 'string') {
      noteContent = aiSummary;
      fullContent = aiSummary;
    } else if (aiSummary && typeof aiSummary === 'object') {
      // For the note display, only show the main purpose
      noteContent = aiSummary.mainPurpose;
      // Store the full structured content
      fullContent = JSON.stringify(aiSummary);
    } else {
      console.error('Invalid summary format');
      return;
    }

    const newNote = {
      id: `${Date.now()}-note`,
      content: noteContent,
      fullContent: fullContent,
      startLine: -1, // Special value to prevent highlighting
      endLine: -1,   // Special value to prevent highlighting
      filePath: path || '',
      tags: ['AI Summary'],
      isSummary: true
    };

    setNotes(prev => [newNote, ...prev]);
    setIsAISummaryOpen(false);
  };

  const handleSummaryClick = (summary: string) => {
    try {
      const parsedSummary = JSON.parse(summary);
      setAISummary(parsedSummary);
      setIsAISummaryOpen(true);
    } catch (e) {
      // If it's not JSON, it's a string summary
      setAISummary(summary);
      setIsAISummaryOpen(true);
    }
  };

  useEffect(() => {
    console.log('Rendering Notepad with notes:', notes);
  }, [notes]);

  const handleZoomIn = () => {
    setFontSize(prev => Math.min(prev + 2, 24));
  };

  const handleZoomOut = () => {
    setFontSize(prev => Math.max(prev - 2, 10));
  };

  if (isLoading) {
    return (
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="space-y-3">
              <div className="h-4 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-auto p-6 pt-20">
        <div className="max-w-[95%] mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <button
                onClick={handleBackClick}
                className="flex items-center text-gray-600 hover:text-gray-900 mr-4"
              >
                <ArrowLeft className="h-5 w-5 mr-2" />
                Back to Workspace
              </button>
              <h1 className="text-2xl font-bold">
                {owner}/{repo}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setIsNotepadOpen(!isNotepadOpen)}
                      className="flex items-center justify-center w-10 h-10 bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-200 rounded-lg hover:bg-orange-200 dark:hover:bg-orange-800 transition-colors shadow-sm hover:shadow-md border border-orange-700 dark:border-orange-600"
                    >
                      <PiNotePencilBold className="w-5 h-5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Open Notepad</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={handleAISummary}
                      className="flex items-center justify-center w-10 h-10 bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-200 rounded-lg hover:bg-orange-200 dark:hover:bg-orange-800 transition-colors shadow-sm hover:shadow-md border border-orange-700 dark:border-orange-600"
                    >
                      <RiSparklingLine className="w-5 h-5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Generate an AI Summary</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={handleCopyFile}
                      className="flex items-center justify-center w-10 h-10 bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-200 rounded-lg hover:bg-orange-200 dark:hover:bg-orange-800 transition-colors shadow-sm hover:shadow-md border border-orange-700 dark:border-orange-600"
                    >
                      {isCopying ? (
                        <Check className="w-5 h-5 text-green-600" />
                      ) : (
                        <Copy className="w-5 h-5" />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Copy file</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
          <div className="flex items-center mb-4">
            <h2 className="text-lg font-semibold">{currentFile?.path}</h2>
          </div>
          <div 
            className={`relative rounded-lg border border-gray-300 ${mode === 'dark' ? 'bg-[#282c34]' : 'bg-[#f8f8f8]'} overflow-hidden group mb-8`}
            onMouseUp={handleTextSelection}
            ref={codeRef}
          >
            {/* Floating zoom controls */}
            <div className="absolute top-2 right-2 z-10 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={handleZoomOut}
                      className="p-1 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors shadow-sm"
                      title="Zoom out"
                    >
                      <Minus className="w-4 h-4 text-white" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Zoom out</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={handleZoomIn}
                      className="p-1 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors shadow-sm"
                      title="Zoom in"
                    >
                      <Plus className="w-4 h-4 text-white" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Zoom in</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            <ScrollArea className="w-full overflow-x-auto">
              <SyntaxHighlighter
                language={getLanguageFromPath(currentFile?.path || '')}
                style={mode === 'dark' ? atomOneDark : solarizedLight}
                customStyle={{
                  margin: 0,
                  padding: '1rem 1rem 0 1rem',
                  background: mode === 'dark' ? '#282c34' : '#f8f8f8',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  fontSize: `${fontSize}px`,
                  lineHeight: '1.5',
                  height: 'calc(100vh - 240px)',
                  maxHeight: 'none',
                  overflowY: 'auto',
                }}
                showLineNumbers
                wrapLines
                lineNumberStyle={{
                  color: mode === 'dark' ? '#636d83' : '#93a1a1',
                  minWidth: '2.5em',
                  paddingRight: '1em',
                  textAlign: 'right',
                  userSelect: 'none',
                }}
                lineProps={(lineNumber) => {
                  const style = { display: 'block' }
                  const { lines, selectedLines, hoveredLines, clickedLines } = getHighlightedLines()
                  
                  if (clickedLines.includes(lineNumber)) {
                    return {
                      style: { ...style, backgroundColor: '#fed7aa', color: 'black' }
                    }
                  } else if (selectedLines.includes(lineNumber)) {
                    return {
                      style: { ...style, backgroundColor: '#fdba74', color: 'black' }
                    }
                  } else if (lines.includes(lineNumber)) {
                    return {
                      style: { ...style, backgroundColor: '#fff7ed', color: 'black' }
                    }
                  }
                  return { style }
                }}
              >
                {currentFile?.content || ''}
              </SyntaxHighlighter>
            </ScrollArea>
          </div>
        </div>
      </div>
      <div 
        ref={notepadRef}
        className={`fixed right-0 top-14 bottom-0 bg-white dark:bg-gray-800 border-l border-gray-100 dark:border-gray-700 shadow-lg transition-all duration-300 ease-in-out transform ${isNotepadOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <Notepad
          notes={notes}
          snippets={snippets}
          currentFilePath={currentFile?.path || path || ''}
          onAnnotationClick={handleAnnotationClick}
          onEditNote={handleEditNote}
          onDeleteNote={handleDeleteNote}
          onSummaryClick={handleSummaryClick}
        />
      </div>
      <AnnotationModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingNote(null);
        }}
        onSave={handleSaveAnnotation}
        selection={selection}
        editingNote={editingNote}
      />
      <AISummaryModal
        isOpen={isAISummaryOpen}
        onOpenChange={setIsAISummaryOpen}
        summary={aiSummary}
        onAddNote={handleAddSummaryNote}
        isGenerating={isGenerating}
      />
    </div>
  )
}

export default CodeViewer 