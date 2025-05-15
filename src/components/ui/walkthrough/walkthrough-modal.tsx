import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../dialog'
import { SiOpenai } from 'react-icons/si'
import { Lightbulb, BookOpen, Brain, StickyNote, GitBranch } from 'lucide-react'
import { RiSparklingLine } from 'react-icons/ri'
import { MultiStepModal } from './multi-step-modal'
import { useWorkspace } from '../../../context/WorkspaceContext'
import { useNavigate, useParams } from 'react-router-dom';
import { useTheme } from '../../../context/ThemeContext';

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
  const navigate = useNavigate();
  const { owner, repo } = useParams<{ owner: string; repo: string }>();
  const { mode } = useTheme();

  const handleStartWalkthrough = () => {
    navigate(`/walkthrough/${owner}/${repo}`);
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
      <DialogContent className={`sm:max-w-[600px] ${mode === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-orange-200'}`}>
        <DialogHeader>
          <DialogTitle className="text-orange-600 dark:text-orange-400 font-display text-2xl">
            Code Walkthrough
          </DialogTitle>
          <DialogDescription className="text-gray-600 dark:text-gray-300">
            Let's explore your codebase together
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 space-y-4">
          <div className={`p-4 rounded-lg border ${mode === 'dark' ? 'bg-orange-900/20 border-orange-800' : 'bg-orange-50 border-orange-200'}`}>
            <h3 className="text-lg font-display text-orange-700 dark:text-orange-400 mb-2">What to Expect</h3>
            <ul className="space-y-2 text-gray-700 dark:text-gray-300 font-display text-lg">
              <li className="flex items-start gap-2">
                <span className="text-orange-500 dark:text-orange-400">•</span>
                <span>An AI-powered guided tour of your codebase structure</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-500 dark:text-orange-400">•</span>
                <span>Interactive exploration of key files and their relationships</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-500 dark:text-orange-400">•</span>
                <span>Highlights of important architectural decisions and patterns</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-500 dark:text-orange-400">•</span>
                <span>Insights into code organization and best practices</span>
              </li>
            </ul>
          </div>
          <div className={`p-4 rounded-lg border ${mode === 'dark' ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
            <h3 className="text-lg font-display text-gray-700 dark:text-gray-200 mb-2">How It Works</h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${mode === 'dark' ? 'bg-orange-900/30' : 'bg-orange-100'}`}>
                  <Brain className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <h4 className="font-display text-gray-800 dark:text-gray-200">AI Analysis</h4>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">Our AI models analyze your codebase to understand its structure and patterns</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${mode === 'dark' ? 'bg-orange-900/30' : 'bg-orange-100'}`}>
                  <Lightbulb className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <h4 className="font-display text-gray-800 dark:text-gray-200">Smart Insights</h4>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">Get intelligent insights about your code's architecture and design decisions</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${mode === 'dark' ? 'bg-orange-900/30' : 'bg-orange-100'}`}>
                  <GitBranch className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <h4 className="font-display text-gray-800 dark:text-gray-200">Interactive Navigation</h4>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">Explore your codebase through an interactive guided tour</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${mode === 'dark' ? 'bg-orange-900/30' : 'bg-orange-100'}`}>
                  <StickyNote className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <h4 className="font-display text-gray-800 dark:text-gray-200">Personal Notes</h4>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">Organize your own notes and insights as you explore</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${mode === 'dark' ? 'bg-orange-900/30' : 'bg-orange-100'}`}>
                  <BookOpen className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <h4 className="font-display text-gray-800 dark:text-gray-200">Learning Journey</h4>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">Follow a structured learning path through your codebase</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <button
            onClick={handleStartWalkthrough}
            className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-display text-lg shadow-md hover:shadow-lg flex items-center gap-2"
          >
            Generate
            <RiSparklingLine className="w-5 h-5" />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default WalkthroughModal 