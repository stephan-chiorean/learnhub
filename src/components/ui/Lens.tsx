import React, { useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { Folder, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface LensProps {
  text: string | null;
  folderName?: string;
  isMinimized: boolean;
  onMinimizeChange: (minimized: boolean) => void;
  onHoverChange: (hovered: boolean) => void;
}

const Lens: React.FC<LensProps> = ({ text, folderName, isMinimized, onMinimizeChange, onHoverChange }) => {
  const { mode, theme } = useTheme();
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseEnter = () => {
    setIsHovered(true);
    onHoverChange(true);
    onMinimizeChange(false);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    onHoverChange(false);
  };

  const contentVariants = {
    initial: { opacity: 0, y: 10 },
    animate: { 
      opacity: 1, 
      y: 0,
      transition: {
        duration: 0.2,
        ease: "easeOut"
      }
    },
    exit: { 
      opacity: 0,
      y: 10,
      transition: {
        duration: 0.15,
        ease: "easeIn"
      }
    }
  };

  const containerVariants = {
    initial: { scale: 1 },
    hover: { 
      scale: 1.02,
      transition: {
        duration: 0.2,
        ease: "easeOut"
      }
    }
  };

  return (
    <AnimatePresence>
      {!isMinimized && (
        <motion.div 
          className="absolute bottom-8 right-8 z-50 w-[400px] cursor-pointer"
          initial="initial"
          animate="animate"
          exit="exit"
          variants={contentVariants}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <motion.div
            className="relative rounded-xl shadow-2xl overflow-hidden w-full"
            variants={containerVariants}
            initial="initial"
            whileHover="hover"
            style={{
              background: mode === 'dark' ? theme.colors.gray[800] : theme.colors.gray[50],
              border: `1px solid ${mode === 'dark' ? theme.colors.gray[700] : theme.colors.gray[200]}`,
              color: mode === 'dark' ? theme.colors.gray[100] : theme.colors.gray[900],
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
            }}
          >
            {/* Header */}
            <div className="relative flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <Folder className="w-5 h-5 text-primary-500" fill="currentColor" />
                <AnimatePresence mode="wait">
                  {folderName && (
                    <motion.span 
                      key={folderName}
                      className="font-medium text-primary-500"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      transition={{ duration: 0.2 }}
                    >
                      {folderName}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-orange-500 dark:bg-orange-900 text-white dark:text-orange-200 rounded-lg hover:bg-orange-600 dark:hover:bg-orange-800 transition-colors font-display text-xs shadow-sm hover:shadow-md border border-orange-600 dark:border-orange-600"
              >
                Step Through
                <Sparkles className="w-3.5 h-3.5" />
              </motion.button>
            </div>

            {/* Content */}
            <div className="relative p-4">
              <AnimatePresence mode="wait" initial={false}>
                {text ? (
                  <motion.div 
                    key="content"
                    className="text-lg font-display leading-relaxed"
                    variants={contentVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                  >
                    {text}
                  </motion.div>
                ) : (
                  <motion.div 
                    key="empty"
                    className="flex flex-col items-center justify-center py-8 text-center text-gray-500 dark:text-gray-400"
                    variants={contentVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                  >
                    <Folder className="w-16 h-16 text-primary-500 mb-4" fill="currentColor" />
                    <p className="text-lg font-display">
                      Hover over a folder to see more context
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Lens; 