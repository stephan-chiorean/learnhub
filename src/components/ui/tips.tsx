import React from 'react';
import { Lightbulb } from 'lucide-react';

interface TipsProps {
  onHide: () => void;
}

const Tips: React.FC<TipsProps> = ({ onHide }) => {
  return (
    <div className="bg-blue-50/80 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 m-4">
      <div className="flex items-start gap-3">
        <Lightbulb className="w-6 h-6 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-1" />
        <div className="flex-1">
          <h3 className="text-lg font-display font-semibold text-blue-900 dark:text-blue-200 mb-2">
            Tips for better results
          </h3>
          <ul className="list-disc list-inside space-y-2 text-blue-800 dark:text-blue-300">
            <li>Add relevant files as context using the file picker below</li>
            <li>Be specific about what you want to understand or modify</li>
            <li>Ask about specific functions, classes, or patterns</li>
            <li>Request explanations of complex code sections</li>
          </ul>
        </div>
        <button
          onClick={onHide}
          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

export default Tips; 