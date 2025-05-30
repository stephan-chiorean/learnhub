import React from 'react'
import DefaultView from './DefaultView'

interface PuzzleViewProps {
  content: string
  path: string
  fontSize: number
  getHighlightedLines: () => {
    lines: number[]
    selectedLines: number[]
    hoveredLines: number[]
    clickedLines: number[]
  }
}

const PuzzleView: React.FC<PuzzleViewProps> = (props) => {
  // For now, just use the default view
  // Later we can add semantic chunking functionality
  return <DefaultView {...props} />
}

export default PuzzleView 