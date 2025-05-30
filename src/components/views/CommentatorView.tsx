import React from 'react'
import DefaultView from './DefaultView'

interface CommentatorViewProps {
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

const CommentatorView: React.FC<CommentatorViewProps> = (props) => {
  // For now, just use the default view
  // Later we can add comment-specific functionality
  return <DefaultView {...props} />
}

export default CommentatorView 