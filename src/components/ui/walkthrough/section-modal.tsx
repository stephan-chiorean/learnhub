import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ProgressSlider } from './courseNotebook';
import { useWalkthrough, Section } from '../../../context/WalkthroughContext';

interface SectionModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  currentSection: string;
}

const SectionModal: React.FC<SectionModalProps> = ({ isOpen, onOpenChange, currentSection }) => {
  const navigate = useNavigate();
  const { owner, repo } = useParams<{ owner: string; repo: string }>();
  const { plan } = useWalkthrough();

  if (!isOpen) return null;

  const handleSectionClick = (sectionId: string) => {
    if (owner && repo) {
      navigate(`/course/${owner}/${repo}/${sectionId}`);
      onOpenChange(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-30">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-2xl font-['Gaegu'] text-black">Course Navigator</h2>
          <button
            onClick={() => onOpenChange(false)}
            className="text-gray-500 hover:text-gray-700"
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
                    ? 'bg-orange-50 border-orange-200'
                    : 'bg-white border-gray-200 hover:bg-orange-50 hover:border-orange-200'
                }`}
                onClick={() => handleSectionClick(section.sectionId)}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-['Gaegu'] text-orange-700">
                    {section.section}
                    {isCurrentSection && (
                      <span className="ml-2 text-sm text-orange-500">(Current)</span>
                    )}
                  </h3>
                  <span className="text-sm text-gray-500">
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