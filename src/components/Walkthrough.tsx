import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWorkspace } from '../context/WorkspaceContext';
import axios from 'axios';
import Lottie from 'lottie-react';
import AtomLoader from '../../assets/AtomLoader.json';
import { Checkbox } from './ui/checkbox';
import { Button } from './ui/button';

interface Section {
  section: string;
  description: string;
  files: string[];
  linkPrevious: string | null;
  linkNext: string | null;
}

const Walkthrough: React.FC = () => {
  const { owner, repo } = useParams<{ owner: string; repo: string }>();
  const { namespace } = useWorkspace();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<Section[]>([]);
  const [selectedSections, setSelectedSections] = useState<Set<number>>(new Set());
  const hasFetched = useRef(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (hasFetched.current) return;
    
    const fetchPlan = async () => {
      try {
        hasFetched.current = true;
        const response = await axios.post('/api/plan', { namespace });
        setPlan(response.data.plan);
        setSelectedSections(new Set(response.data.plan.map((_: Section, index: number) => index)));
        setIsLoading(false);
      } catch (err) {
        setError('Failed to fetch walkthrough plan');
        setIsLoading(false);
      }
    };

    fetchPlan();
  }, [namespace]);

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
        <h2 className="text-3xl font-['Gaegu'] text-orange-700 mt-4">
          Planning your walkthrough...
        </h2>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen pt-14">
        <h2 className="text-3xl font-['Gaegu'] text-red-600">
          {error}
        </h2>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-8 mt-14 h-[calc(100vh-3.5rem)] overflow-y-auto">
      <div className="flex justify-between items-center mb-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-['Gaegu'] text-orange-700">
            Overview
          </h1>
          <p className="text-md text-gray-500">
            Deselect sections you want to omit
          </p>
        </div>
        <Button 
          className="bg-orange-500 text-white hover:bg-orange-600 font-['Gaegu'] text-lg"
          onClick={() => navigate(`/walkthrough/${owner}/${repo}/start`)}
        >
          Begin Walkthrough
        </Button>
      </div>
      
      <div className="space-y-8">
        {plan.map((section, index) => (
          <div key={index} className="bg-white rounded-lg shadow-md p-6 flex gap-4">
            <div className="flex items-start pt-1">
              <Checkbox
                checked={selectedSections.has(index)}
                onCheckedChange={() => toggleSection(index)}
                className="border-orange-500 data-[state=checked]:bg-orange-500"
              />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl font-['Gaegu'] text-orange-600">
                  {index + 1}.
                </span>
                <h2 className="text-2xl font-['Gaegu'] text-orange-600">
                  {section.section}
                </h2>
              </div>
              <p className="text-gray-700 mb-4">
                {section.description}
              </p>
              {section.linkPrevious && (
                <p className="text-sm text-gray-500 italic mb-2">
                  Connects from: {section.linkPrevious}
                </p>
              )}
              {section.linkNext && (
                <p className="text-sm text-gray-500 italic">
                  Leads to: {section.linkNext}
                </p>
              )}
              <div className="mt-4">
                <h3 className="text-lg font-['Gaegu'] text-black mb-2">
                  Key Files:
                </h3>
                <ul className="list-disc list-inside text-gray-600">
                  {section.files.map((file, fileIndex) => (
                    <li key={fileIndex}>
                      <button
                        onClick={() => navigate(`/workspace/${owner}/${repo}/file?path=${file}`)}
                        className="text-orange-500 hover:text-orange-600 hover:underline"
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
  );
};

export default Walkthrough; 