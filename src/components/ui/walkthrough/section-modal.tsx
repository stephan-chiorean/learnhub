import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ProgressSlider } from './courseNotebook';
import { useWalkthrough, Section } from '../../../context/WalkthroughContext';
import { useTheme } from '../../../context/ThemeContext';

interface SectionModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  currentSection: string;
}

const SectionModal: React.FC<SectionModalProps> = ({ isOpen, onOpenChange, currentSection }) => {
  const navigate = useNavigate();
  const { owner, repo } = useParams<{ owner: string; repo: string }>();
  const { plan } = useWalkthrough();
  const { mode, theme } = useTheme();

  if (!isOpen) return null;

  const handleSectionClick = (sectionId: string) => {
    if (owner && repo) {
      navigate(`/course/${owner}/${repo}/${sectionId}`);
      onOpenChange(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-30">
      <div className={`bg-white dark:bg-gray-800 rounded-lg w-full max-w-2xl max-h-[80vh] flex flex-col ${theme.shadows.lg}`}>
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className={`text-2xl font-display text-gray-900 dark:text-gray-100`}>Course Navigator</h2>
          <button
            onClick={() => onOpenChange(false)}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {plan.map((section) => {
            const isCurrentSection = section.sectionId === currentSection;

            return (
              <div
                key={section.sectionId}
                className={`p-4 rounded-lg border transition-all duration-200 cursor-pointer ${
                  isCurrentSection
                    ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-orange-50 dark:hover:bg-orange-900/20 hover:border-orange-200 dark:hover:border-orange-800'
                }`}
                onClick={() => handleSectionClick(section.sectionId)}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className={`text-lg font-display text-orange-700 dark:text-orange-400`}>
                    {section.section}
                    {isCurrentSection && (
                      <span className="ml-2 text-sm text-orange-500 dark:text-orange-300">(Current)</span>
                    )}
                  </h3>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {section.files.length} files
                  </span>
                </div>
                <ProgressSlider
                  totalSteps={section.files.length}
                  completedSteps={0} // TODO: Implement actual progress tracking
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SectionModal; 