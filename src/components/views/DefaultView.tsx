import React from 'react'
import SyntaxHighlighter from 'react-syntax-highlighter'
import { solarizedLight, atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs'
import { getLanguageFromPath } from '../../utils/languageDetector'
import { useTheme } from '../../context/ThemeContext'

interface DefaultViewProps {
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

const DefaultView: React.FC<DefaultViewProps> = ({
  content,
  path,
  fontSize,
  getHighlightedLines
}) => {
  const { mode } = useTheme()

  return (
    <SyntaxHighlighter
      language={getLanguageFromPath(path)}
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
      {content}
    </SyntaxHighlighter>
  )
}

export default DefaultView 