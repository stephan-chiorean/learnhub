import { useState } from 'react';

const useSidebar = () => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  return {
    isOpen,
    toggleSidebar,
  };
};

export default useSidebar; 