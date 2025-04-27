import React, { useState } from 'react';

const RepoItem = ({ name, items }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mb-2">
      <div 
        className="repo-item flex items-center py-2 px-2 rounded-md cursor-pointer hover:bg-gray-50"
        onClick={() => setIsOpen(!isOpen)}
      >
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          className={`h-4 w-4 text-gray-400 mr-1 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
        </svg>
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
        <span className="text-sm">{name}</span>
      </div>
      {isOpen && (
        <div className="pl-7">
          {items.map((item, index) => (
            <div key={index} className="flex items-center py-2 px-2 rounded-md hover:bg-gray-50 cursor-pointer">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-orange-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={item.iconPath} />
              </svg>
              <span className="text-sm">{item.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const Sidebar = ({ isOpen }) => {
  const repositories = [
    {
      name: 'react-beautiful-dnd',
      items: [
        { name: 'Notes', iconPath: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
        { name: 'Code Snippets', iconPath: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4' },
        { name: 'Diagrams', iconPath: 'M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z' }
      ]
    },
    {
      name: 'next.js',
      items: [
        { name: 'Notes', iconPath: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
        { name: 'Code Snippets', iconPath: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4' }
      ]
    }
  ];

  return (
    <aside className={`fixed top-14 left-0 bottom-0 bg-white border-r border-gray-100 z-10 shadow-sm overflow-y-auto w-64 ${isOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out`}>
      <div className="p-4">
        <h2 className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-4">Repositories</h2>
        {repositories.map((repo, index) => (
          <RepoItem key={index} name={repo.name} items={repo.items} />
        ))}
      </div>
    </aside>
  );
};

export default Sidebar; 