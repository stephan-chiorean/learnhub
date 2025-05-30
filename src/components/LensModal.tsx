import React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog'
import { MessageSquare, Highlighter, Puzzle, Eye } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'

interface LensModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onSelectLens: (lens: 'commentator' | 'highlighter' | 'puzzle' | 'default') => void
}

const LensModal: React.FC<LensModalProps> = ({
  isOpen,
  onOpenChange,
  onSelectLens
}) => {
  const { mode } = useTheme()
  const lenses = [
    {
      id: 'default',
      name: 'Default View',
      icon: Eye,
      description: 'Standard code view',
      color: 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
    },
    {
      id: 'commentator',
      name: 'Commentator',
      icon: MessageSquare,
      description: 'Add comments and notes',
      color: 'bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400'
    },
    {
      id: 'highlighter',
      name: 'Highlighter',
      icon: Highlighter,
      description: 'Highlight important sections',
      color: 'bg-orange-100 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400'
    },
    {
      id: 'puzzle',
      name: 'Code Chunks',
      icon: Puzzle,
      description: 'Group code semantically',
      color: 'bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400'
    }
  ]

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className={`sm:max-w-[600px] ${mode === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-orange-200'}`}>
        <DialogHeader>
          <DialogTitle className="text-orange-600 dark:text-orange-400 font-display text-2xl">
            Code Lens
          </DialogTitle>
          <DialogDescription className="text-gray-600 dark:text-gray-300">
            Choose how you want to view and interact with your code
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4">
          <div className={`p-4 rounded-lg border ${mode === 'dark' ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
            <div className="grid grid-cols-2 gap-4">
              {lenses.map((lens) => {
                const Icon = lens.icon
                return (
                  <button
                    key={lens.id}
                    onClick={() => {
                      onSelectLens(lens.id as any)
                      onOpenChange(false)
                    }}
                    className={`${lens.color} p-4 rounded-xl hover:scale-105 transition-all duration-200 flex flex-col items-center gap-2 border ${mode === 'dark' ? 'border-gray-600' : 'border-gray-200'}`}
                  >
                    <Icon className="w-8 h-8" />
                    <span className="font-medium">{lens.name}</span>
                    <span className="text-sm text-center opacity-75">{lens.description}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default LensModal 