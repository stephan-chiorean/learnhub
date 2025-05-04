import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../dialog'
import { SiOpenai } from 'react-icons/si'
import { Lightbulb, BookOpen, Brain, StickyNote, GitBranch } from 'lucide-react'
import { MultiStepModal } from './multi-step-modal'
import { useWorkspace } from '../../../context/WorkspaceContext'

interface WalkthroughModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

const WalkthroughModal: React.FC<WalkthroughModalProps> = ({
  isOpen,
  onOpenChange,
}) => {
  const [showMultiStep, setShowMultiStep] = useState(false);
  const { namespace } = useWorkspace();

  const handleStartWalkthrough = () => {
    setShowMultiStep(true);
  };

  const handleMultiStepSubmit = (data: any) => {
    console.log('Walkthrough data:', data);
    onOpenChange(false);
  };

  if (showMultiStep) {
    return (
      <MultiStepModal
        isOpen={isOpen}
        onClose={() => {
          setShowMultiStep(false);
          onOpenChange(false);
        }}
        onSubmit={handleMultiStepSubmit}
        namespace={namespace || ''}
      />
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] bg-white border-orange-200">
        <DialogHeader>
          <DialogTitle className="text-orange-600 flex items-center gap-2">
            <SiOpenai className="w-5 h-5" />
            Code Walkthrough
          </DialogTitle>
          <DialogDescription className="text-gray-600">
            Let's explore your codebase together
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 space-y-4">
          <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
            <h3 className="text-lg font-semibold text-orange-700 mb-2">What to Expect</h3>
            <ul className="space-y-2 text-gray-700 font-['Gaegu'] text-lg">
              <li className="flex items-start gap-2">
                <span className="text-orange-500">•</span>
                <span>An AI-powered guided tour of your codebase structure</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-500">•</span>
                <span>Interactive exploration of key files and their relationships</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-500">•</span>
                <span>Highlights of important architectural decisions and patterns</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-500">•</span>
                <span>Insights into code organization and best practices</span>
              </li>
            </ul>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">How It Works</h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Brain className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <h4 className="font-medium text-gray-800">AI Analysis</h4>
                  <p className="text-gray-600 text-sm">Our AI models analyze your codebase to understand its structure and patterns</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Lightbulb className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <h4 className="font-medium text-gray-800">Smart Insights</h4>
                  <p className="text-gray-600 text-sm">Get intelligent insights about your code's architecture and design decisions</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <GitBranch className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <h4 className="font-medium text-gray-800">Interactive Navigation</h4>
                  <p className="text-gray-600 text-sm">Explore your codebase through an interactive guided tour</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <StickyNote className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <h4 className="font-medium text-gray-800">Personal Notes</h4>
                  <p className="text-gray-600 text-sm">Organize your own notes and insights as you explore</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <BookOpen className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <h4 className="font-medium text-gray-800">Learning Journey</h4>
                  <p className="text-gray-600 text-sm">Follow a structured learning path through your codebase</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <button
            onClick={handleStartWalkthrough}
            className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-['Gaegu'] text-lg shadow-md hover:shadow-lg"
          >
            Start Walkthrough
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default WalkthroughModal 