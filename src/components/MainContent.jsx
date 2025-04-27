import React from 'react';

const MainContent = ({ isSidebarOpen }) => {
  return (
    <main className={`pt-14 min-h-screen bg-gray-50 flex flex-col items-center justify-center ${isSidebarOpen ? 'ml-64' : 'ml-0'} transition-all duration-300 ease-in-out w-full`}>
      <div className="flex flex-col items-center justify-center w-full max-w-4xl px-4">
        {/* Walkthrough Logo */}
        <div className="mb-10 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-orange-500">
            <path d="M12 19l7-7 3 3-7 7-3-3z"></path>
            <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path>
            <path d="M2 2l7.586 7.586"></path>
            <circle cx="11" cy="11" r="2"></circle>
          </svg>
          <div className="ml-4 text-4xl font-medium">
            Walk<span className="text-orange-500">through</span>
          </div>
        </div>
        
        {/* Search Input */}
        <div className="search-container">
          <div className="search-input flex items-center w-full px-4 py-3 rounded-full border border-gray-200">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input 
              type="text" 
              placeholder="Paste GitHub repository URL" 
              className="w-full text-sm text-gray-700 bg-transparent outline-none"
            />
          </div>
        </div>
        
        {/* Start Learning Button */}
        <div className="flex justify-center w-full mt-6">
          <button className="start-button w-fit py-3 px-8 rounded-full text-white font-medium shadow-sm">
            Start Learning
          </button>
        </div>
      </div>
    </main>
  );
};

export default MainContent; 