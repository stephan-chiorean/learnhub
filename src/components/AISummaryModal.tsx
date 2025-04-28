import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { SiOpenai } from 'react-icons/si'

interface KeyComponent {
  name: string
  description: string
}

interface SummaryJSON {
  title: string
  mainPurpose: string
  keyComponents: KeyComponent[]
  overallStructure: string
}

interface AISummaryModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  summary: SummaryJSON | string
  onAddNote?: () => void
  isGenerating?: boolean
}

const fontClass = "font-['Gaegu'] text-lg text-gray-700";

const AISummaryModal: React.FC<AISummaryModalProps> = ({
  isOpen,
  onOpenChange,
  summary,
  onAddNote,
  isGenerating = false
}) => {
  // If summary is a string (e.g., loading or error), just show it
  if (typeof summary === 'string') {
    return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[1200px] bg-white border-orange-200 [&>button]:hidden">
          <DialogHeader>
            <DialogTitle className="text-orange-600 flex items-center gap-2">
              <SiOpenai className="w-5 h-5" />
              AI Summary
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200 overflow-x-auto max-h-[70vh] overflow-y-auto">
            <pre className={fontClass + " whitespace-pre-wrap break-words max-w-full"}>{summary}</pre>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => onOpenChange(false)}
              className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-['Gaegu'] text-lg shadow-md hover:shadow-lg"
            >
              Cancel
            </button>
            {onAddNote && (
              <button
                onClick={onAddNote}
                disabled={isGenerating}
                className={`px-6 py-2 rounded-lg transition-colors font-['Gaegu'] text-lg shadow-md hover:shadow-lg ${
                  isGenerating
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-orange-500 text-white hover:bg-orange-600'
                }`}
              >
                Add Note
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  // Otherwise, render the structured summary
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[1200px] bg-white border-orange-200 [&>button]:hidden">
        <DialogHeader>
          <DialogTitle className="text-orange-600 flex items-center gap-2">
            <SiOpenai className="w-5 h-5" />
            AI Summary
          </DialogTitle>
        </DialogHeader>
        <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200 overflow-x-auto max-h-[70vh] overflow-y-auto">
          <div className={fontClass + " max-w-full break-words"}>
            <h2 className="text-2xl font-bold mb-2">{summary.title}</h2>
            <div className="mb-4">
              <span className="block text-xl font-semibold mb-1">Main Purpose</span>
              <span>{summary.mainPurpose}</span>
            </div>
            <div className="mb-4">
              <span className="block text-xl font-semibold mb-1">Key Components</span>
              <ol className="list-decimal ml-6">
                {summary.keyComponents.map((comp, idx) => (
                  <li key={idx} className="mb-1">
                    <span className="font-bold">{comp.name}:</span> {comp.description}
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <span className="block text-xl font-semibold mb-1">Overall Structure</span>
              <span>{summary.overallStructure}</span>
            </div>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={() => onOpenChange(false)}
            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-['Gaegu'] text-lg shadow-md hover:shadow-lg"
          >
            Close
          </button>
          {onAddNote && (
            <button
              onClick={onAddNote}
              disabled={isGenerating}
              className={`px-6 py-2 rounded-lg transition-colors font-['Gaegu'] text-lg shadow-md hover:shadow-lg ${
                isGenerating
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-orange-500 text-white hover:bg-orange-600'
              }`}
            >
              Add Note
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default AISummaryModal 