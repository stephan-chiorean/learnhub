import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';
import { useWorkspace } from './WorkspaceContext';
import { hardcodedPlan } from '../lib/mock/plan';
export interface Section {
  section: string;
  sectionId: string;
  description: string[];
  files: string[];
}

interface WalkthroughContextType {
  plan: Section[];
  isLoading: boolean;
  error: string | null;
}

const WalkthroughContext = createContext<WalkthroughContextType | undefined>(undefined);

export const WalkthroughProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [plan, setPlan] = useState<Section[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { namespace } = useWorkspace();

  useEffect(() => {
    console.log(namespace);
    if (!namespace) return;

    const fetchPlan = async () => {
      setIsLoading(true);
      setError(null);
      try {

        setPlan(hardcodedPlan);
        
        // --- Original fetch (commented out for now) ---
        /*
        const response = await axios.post('/api/plan', { namespace });
        setPlan(response.data.plan);
        */
      } catch (err) {
        setError('Failed to fetch walkthrough plan');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPlan();
  }, [namespace]);

  return (
    <WalkthroughContext.Provider value={{
      plan,
      isLoading,
      error,
    }}>
      {children}
    </WalkthroughContext.Provider>
  );
};

export const useWalkthrough = () => {
  const context = useContext(WalkthroughContext);
  if (context === undefined) {
    throw new Error('useWalkthrough must be used within a WalkthroughProvider');
  }
  return context;
}; 