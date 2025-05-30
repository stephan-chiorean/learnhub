import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWalkthrough } from '../context/WalkthroughContext';
import Lottie from 'lottie-react';
import AtomLoader from '../../assets/AtomLoader.json';
import { Checkbox } from '../components/ui/checkbox';
import { Button } from '../components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip';
import { HelpCircle } from 'lucide-react';

const Walkthrough: React.FC = () => {
  const { owner, repo } = useParams<{ owner: string; repo: string }>();
  const { plan, isLoading, error } = useWalkthrough();
  const [selectedSections, setSelectedSections] = useState<Set<number>>(new Set());
  const navigate = useNavigate();

  useEffect(() => {
    console.log(plan);
    if (plan.length > 0) {
      setSelectedSections(new Set(plan.map((_, index) => index)));
    }
  }, [plan]);

  const toggleSection = (index: number) => {
    setSelectedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen pt-14">
        <div className="w-64 h-64">
          <Lottie animationData={AtomLoader} loop={true} />
        </div>
        <h2 className="text-3xl font-display text-orange-700 dark:text-orange-400 mt-4">
          Planning your walkthrough...
        </h2>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen pt-14">
        <h2 className="text-3xl font-display text-red-600 dark:text-red-400">
          {error}
        </h2>
      </div>
    );
  }

  return (
    <div className="min-h-screen mt-8 bg-gray-50 dark:bg-gray-900 overflow-y-auto">
      <div className="max-w-4xl mx-auto p-8 pt-14 pb-20">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-2">
            <h1 className="text-4xl font-display text-orange-700 dark:text-orange-400">
              Overview
            </h1>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="w-5 h-5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Deselect sections you want to omit</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Button 
            className="bg-orange-500 dark:bg-orange-900 text-white dark:text-orange-200 hover:bg-orange-600 dark:hover:bg-orange-800 font-display text-lg"
            onClick={() => navigate(`/walkthrough/${owner}/${repo}/${plan[0].sectionId}`)}
          >
            Begin Walkthrough
          </Button>
        </div>
        
        <div className="space-y-8">
          {plan.map((section, index) => (
            <div key={index} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 flex gap-4 transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5">
              <div className="flex items-start pt-1">
                <Checkbox
                  checked={selectedSections.has(index)}
                  onCheckedChange={() => toggleSection(index)}
                  className="w-6 h-6 border-2 border-orange-500 data-[state=checked]:bg-green-400 data-[state=checked]:border-green-400 transition-all duration-200 hover:border-orange-600 hover:data-[state=checked]:bg-green-500 hover:data-[state=checked]:border-green-500"
                />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-2xl font-display text-orange-600 dark:text-orange-400">
                    {index + 1}.
                  </span>
                  <h2 className="text-2xl font-display text-orange-600 dark:text-orange-400">
                    {section.section}
                  </h2>
                </div>
                <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 mb-4 space-y-2">
                  {section.description.map((point, pointIndex) => (
                    <li key={pointIndex}>{point}</li>
                  ))}
                </ul>
                <div className="mt-4">
                  <h3 className="text-lg font-display text-black dark:text-white mb-2">
                    Key Files:
                  </h3>
                  <ul className="list-disc list-inside text-gray-600 dark:text-gray-400">
                    {section.files.map((file, fileIndex) => (
                      <li key={fileIndex}>
                        <button
                          onClick={() => navigate(`/workspace/${owner}/${repo}/file?path=${file}`)}
                          className="text-orange-500 dark:text-orange-400 hover:text-orange-600 dark:hover:text-orange-300 hover:underline"
                        >
                          {file}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Walkthrough;