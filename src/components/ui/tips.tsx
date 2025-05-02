import React from 'react';
import { Brain, Lightbulb, BookOpen } from 'lucide-react';

interface TipsProps {
  onHide: () => void;
}

const Tips: React.FC<TipsProps> = ({ onHide }) => {
  return (
    <div className="p-4 bg-orange-50 rounded-lg border border-orange-200 mx-4 mt-2">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold text-orange-700">Tips for Better Responses</h3>
        <button
          onClick={onHide}
          className="text-sm text-orange-600 hover:text-orange-700 font-medium"
        >
          Hide
        </button>
      </div>
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-orange-100 rounded-lg">
            <Brain className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <h4 className="font-medium text-gray-800">Add Context</h4>
            <p className="text-gray-600 text-sm">Select relevant files to help the AI understand your codebase better</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div className="p-2 bg-orange-100 rounded-lg">
            <Lightbulb className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <h4 className="font-medium text-gray-800">Be Specific</h4>
            <p className="text-gray-600 text-sm">Ask detailed questions about specific parts of the code</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div className="p-2 bg-orange-100 rounded-lg">
            <BookOpen className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <h4 className="font-medium text-gray-800">Code Examples</h4>
            <p className="text-gray-600 text-sm">Include code snippets or file paths in your questions</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Tips; 