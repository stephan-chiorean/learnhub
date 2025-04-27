import React, { useState, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useWorkspace } from '../context/WorkspaceContext'
import SyntaxHighlighter from 'react-syntax-highlighter'
import { docco } from 'react-syntax-highlighter/dist/esm/styles/hljs'
import AnnotationModal from './AnnotationModal'
import Notepad from './Notepad'

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
  const codeRef = useRef<HTMLDivElement>(null)
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null)
  const [notes, setNotes] = useState<any[]>([])
  const [snippets, setSnippets] = useState<any[]>([])
  const [hoveredAnnotation, setHoveredAnnotation] = useState<{filePath: string, startLine: number, endLine: number} | null>(null)
  const [clickedAnnotation, setClickedAnnotation] = useState<{filePath: string, startLine: number, endLine: number} | null>(null)

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

    setSelection({
      text: selection.toString(),
      startLine: start + 1,
      endLine: end + 1,
      filePath: path || '',
    })
    setIsModalOpen(true)
  }

  const handleSaveAnnotation = (data: any) => {
    if (!selection) return
    if (data.type === 'note') {
      setNotes(prev => [
        { ...data, id: `${Date.now()}-note` },
        ...prev
      ])
    } else if (data.type === 'snippet') {
      setSnippets(prev => [
        { ...data, id: `${Date.now()}-snippet` },
        ...prev
      ])
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
          <div className="flex items-center mb-6">
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
          <div className="grid grid-cols-[auto_300px] gap-4">
            <div className="flex items-center">
              <h2 className="text-lg font-semibold">{currentFile?.path}</h2>
            </div>
            <div className="flex items-center">
              <h3 className="text-2xl font-['Gaegu'] text-orange-700">Notepad</h3>
            </div>
          </div>
          <div className="grid grid-cols-[auto_300px] gap-4 mt-4">
            <div 
              className="bg-white rounded-lg shadow p-4"
              onMouseUp={handleTextSelection}
              ref={codeRef}
            >
              <SyntaxHighlighter
                language="javascript"
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
            />
          </div>
        </div>
      </div>
      <AnnotationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveAnnotation}
        selection={selection}
      />
    </div>
  )
}

export default CodeViewer 