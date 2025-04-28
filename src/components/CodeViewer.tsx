import React, { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useWorkspace } from '../context/WorkspaceContext'
import SyntaxHighlighter from 'react-syntax-highlighter'
import { docco } from 'react-syntax-highlighter/dist/esm/styles/hljs'
import AnnotationModal from './AnnotationModal'
import Notepad from './Notepad'
import { Copy, Check } from 'lucide-react'
import { SiOpenai } from 'react-icons/si'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip'
import AISummaryModal from './AISummaryModal'
import { getLanguageFromPath } from '../utils/languageDetector'

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
    if (editingNote) {
      // Update existing note
      setNotes(prev => prev.map(note => 
        note.id === editingNote.id ? { ...data, id: note.id } : note
      ));
      setEditingNote(null);
    } else {
      // Create new note
      setNotes(prev => [
        { ...data, id: `${Date.now()}-note` },
        ...prev
      ]);
    }
  }

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
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-[95%] mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <button
                onClick={handleBackClick}
                className="flex items-center text-gray-600 hover:text-gray-900 mr-4"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 mr-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
                Back to Workspace
              </button>
              <h1 className="text-2xl font-bold">
                {owner}/{repo}
              </h1>
            </div>
          </div>
          <div className="grid grid-cols-[auto_400px] gap-4">
            <div className="flex items-center">
              <h2 className="text-lg font-semibold">{currentFile?.path}</h2>
            </div>
            <div className="flex items-center">
              <h3 className="text-2xl font-['Gaegu'] text-orange-700">Notepad</h3>
            </div>
          </div>
          <div className="grid grid-cols-[auto_400px] gap-4 mt-4">
            <div 
              className="bg-white rounded-lg shadow p-4 relative"
              onMouseUp={handleTextSelection}
              ref={codeRef}
            >
              <div className="absolute top-2 right-2 flex gap-2 z-10">
                <button
                  onClick={handleCopyFile}
                  className="p-2 hover:bg-gray-100 rounded transition-colors bg-white shadow-sm"
                  title="Copy file"
                >
                  {isCopying ? (
                    <Check className="w-5 h-5 text-green-600" />
                  ) : (
                    <Copy className="w-5 h-5 text-gray-500" />
                  )}
                </button>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={handleAISummary}
                        className="p-2 hover:bg-orange-50 rounded transition-colors bg-white shadow-sm"
                      >
                        <SiOpenai className="w-5 h-5 text-orange-500" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Generate an AI Summary</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <SyntaxHighlighter
                language={getLanguageFromPath(currentFile?.path || '')}
                style={docco}
                customStyle={{ margin: 0, padding: '1rem' }}
                showLineNumbers
                wrapLines
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
            </div>
            <Notepad
              notes={notes}
              snippets={snippets}
              currentFilePath={path || ''}
              onAnnotationClick={handleAnnotationClick}
              onEditNote={handleEditNote}
              onDeleteNote={handleDeleteNote}
              onSummaryClick={handleSummaryClick}
            />
          </div>
        </div>
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