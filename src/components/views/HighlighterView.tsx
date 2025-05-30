import React from 'react'
import DefaultView from './DefaultView'

interface HighlighterViewProps {
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

const HighlighterView: React.FC<HighlighterViewProps> = (props) => {
  // For now, just use the default view
  // Later we can add highlighting-specific functionality
  return <DefaultView {...props} />
}

export default HighlighterView 