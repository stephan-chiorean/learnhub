import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { Minimize2, Folder, Aperture } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface LensProps {
  text: string | null;
  folderName?: string;
  isMinimized: boolean;
  onMinimizeChange: (minimized: boolean) => void;
}

const Lens: React.FC<LensProps> = ({ text, folderName, isMinimized, onMinimizeChange }) => {
  const { mode, theme } = useTheme();
  const [isHovered, setIsHovered] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lensRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMinimized) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        if (!isHovered) {
          setShowContent(false);
          onMinimizeChange(true);
        }
      }, 4000);
    } else {
      setShowContent(false);
    }
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isMinimized, isHovered, onMinimizeChange]);

  const handleMouseEnter = () => {
    setIsHovered(true);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  const handleMinimizeFromButton = () => {
    setShowContent(false);
    onMinimizeChange(true);
  };

  const handleAnimationComplete = (definition: any) => {
    if (definition === 'open' && !isMinimized) {
      setShowContent(true);
    } else if (definition === 'closed' && isMinimized) {
      setShowContent(false);
    }
  };

  const lensVariants = {
    open: {
      scale: 1,
      opacity: 1,
      width: '400px',
      height: 'auto',
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 30,
        mass: 0.8
      }
    },
    closed: {
      scale: 1,
      opacity: 1,
      width: '48px',
      height: '48px',
      transition: {
        type: "spring",
        stiffness: 400,
        damping: 35,
        mass: 0.8
      }
    }
  };

  const backgroundVariants = {
    animate: {
      scale: [1, 1.02, 1],
      rotate: [0, 0.5, 0],
      transition: {
        duration: 4,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  };

  const shineVariants = {
    animate: {
      backgroundPosition: ['0% 0%', '100% 100%'],
      transition: {
        duration: 3,
        repeat: Infinity,
        ease: "linear"
      }
    }
  };

  const contentVariants = {
    initial: { opacity: 0 },
    animate: { 
      opacity: 1, 
      transition: {
        delay: 0.15,
        duration: 0.2,
        ease: "easeOut"
      }
    },
    exit: { 
      opacity: 0, 
      transition: {
        duration: 0.15,
        ease: "easeIn"
      }
    }
  };

  const LensIcon = () => (
    <motion.div
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      className="cursor-pointer"
    >
      <Aperture className="w-6 h-6 text-primary-500" />
    </motion.div>
  );

  return (
    <motion.div 
      layout
      className="absolute bottom-8 right-8 z-50"
      initial="closed"
      animate={isMinimized ? "closed" : "open"}
      variants={lensVariants}
      style={{ pointerEvents: 'auto' }}
      ref={lensRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onAnimationComplete={handleAnimationComplete}
    >
      <motion.div
        layout
        className="relative rounded-xl shadow-2xl overflow-hidden w-full h-full"
        style={{
          background: mode === 'dark' ? theme.colors.gray[800] : theme.colors.gray[50],
          border: `1px solid ${mode === 'dark' ? theme.colors.gray[700] : theme.colors.gray[200]}`,
          color: mode === 'dark' ? theme.colors.gray[100] : theme.colors.gray[900],
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          pointerEvents: 'auto'
        }}
      >
        {/* Shiny background effect */}
        <motion.div
          className="absolute inset-0"
          variants={shineVariants}
          animate="animate"
          style={{
            background: `linear-gradient(45deg, 
              transparent 0%, 
              ${mode === 'dark' ? theme.colors.primary[400] : theme.colors.primary[300]} 25%, 
              transparent 50%, 
              ${mode === 'dark' ? theme.colors.primary[400] : theme.colors.primary[300]} 75%, 
              transparent 100%)`,
            backgroundSize: '200% 200%',
            opacity: 0.1,
            pointerEvents: 'none'
          }}
        />

        {/* Animated background */}
        <motion.div
          className="absolute inset-0"
          variants={backgroundVariants}
          animate="animate"
          style={{ pointerEvents: 'none' }}
        >
          <div 
            className="absolute inset-0 opacity-10"
            style={{
              background: `radial-gradient(circle at center, ${mode === 'dark' ? theme.colors.primary[400] : theme.colors.primary[300]} 0%, transparent 70%)`,
            }}
          />
        </motion.div>

        {isMinimized ? (
          <div 
            className="w-full h-full flex items-center justify-center"
            style={{ pointerEvents: 'none' }}
          >
            <LensIcon />
          </div>
        ) : (
          <>
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
            </div>

            {/* Content - Render conditionally based on showContent */}
            {showContent && (
              <div className="relative p-4">
                <AnimatePresence mode="wait" initial={false}>
                  {text ? (
                    <motion.div 
                      key="content"
                      layout
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
                      layout
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
            )}
          </>
        )}
      </motion.div>
    </motion.div>
  );
};

export default Lens; 