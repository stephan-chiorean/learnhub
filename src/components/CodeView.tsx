import React from 'react'
import { ScrollArea } from './ui/scroll-area'
import DefaultView from './views/DefaultView'
import CommentatorView from './views/CommentatorView'
import HighlighterView from './views/HighlighterView'
import PuzzleView from './views/PuzzleView'

interface CodeViewProps {
  content: string
  path: string
  fontSize: number
  getHighlightedLines: () => {
    lines: number[]
    selectedLines: number[]
    hoveredLines: number[]
    clickedLines: number[]
  }
  activeLens: 'default' | 'commentator' | 'highlighter' | 'puzzle'
}

const CodeView: React.FC<CodeViewProps> = ({
  content,
  path,
  fontSize,
  getHighlightedLines,
  activeLens
}) => {
  const renderView = () => {
    switch (activeLens) {
      case 'commentator':
        return <CommentatorView content={content} path={path} fontSize={fontSize} getHighlightedLines={getHighlightedLines} />
      case 'highlighter':
        return <HighlighterView content={content} path={path} fontSize={fontSize} getHighlightedLines={getHighlightedLines} />
      case 'puzzle':
        return <PuzzleView content={content} path={path} fontSize={fontSize} getHighlightedLines={getHighlightedLines} />
      default:
        return <DefaultView content={content} path={path} fontSize={fontSize} getHighlightedLines={getHighlightedLines} />
    }
  }

  return (
    <ScrollArea className="w-full overflow-x-auto">
      {renderView()}
    </ScrollArea>
  )
}

export default CodeView 