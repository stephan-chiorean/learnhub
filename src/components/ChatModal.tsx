import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ContextPopover from './ContextPopover';
import Tips from './ui/tips';
import { getFileIcon } from '../utils/fileIcons';
import { ScrollArea } from './ui/scroll-area';

interface KeyComponent {
  name: string;
  description: string;
}

interface SummaryJSON {
  title: string;
  mainPurpose: string;
  keyComponents: KeyComponent[];
  overallStructure: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string | SummaryJSON;
  relevantFiles?: Array<{
    filePath: string;
    similarity: number;
  }>;
}

interface ChatModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Context {
  path: string;
  type: 'blob' | 'tree' | 'function';
  metadata?: any;
}

const fontClass = "font-display text-lg text-gray-700";

const ChatModal: React.FC<ChatModalProps> = ({ isOpen, onOpenChange }) => {
  const { owner, repo } = useParams<{ owner: string; repo: string }>();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [contexts, setContexts] = useState<Context[]>([]);
  const [showTips, setShowTips] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    console.log('Contexts state changed:', contexts);
  }, [contexts]);

  useEffect(() => {
    // Reset tips visibility when modal opens
    if (isOpen) {
      setShowTips(true);
    }
  }, [isOpen]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const adjustHeight = () => {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    };

    textarea.addEventListener('input', adjustHeight);
    adjustHeight(); // Initial adjustment

    return () => textarea.removeEventListener('input', adjustHeight);
  }, []);

  const handleContextSelect = (path: string, type: 'blob' | 'tree' | 'function', metadata?: any) => {
    setContexts(prev => [...prev, { path, type, metadata }]);
  };

  const handleRemoveContext = (index: number) => {
    setContexts(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !owner || !repo) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);
    setShowTips(false);

    try {
      console.log('Contexts being sent in request:', contexts);
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          namespace: `${owner}_${repo}`,
          question: userMessage,
          contexts: contexts.map(c => ({
            path: c.path,
            type: c.type,
            ...(c.metadata && {
              start_line: c.metadata.start_line,
              end_line: c.metadata.end_line
            })
          }))
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }

      const data = await response.json();
      
      // Try to parse the response as JSON, if it fails, use it as a string
      let formattedContent: string | SummaryJSON;
      try {
        formattedContent = JSON.parse(data.response);
      } catch {
        formattedContent = data.response;
      }

      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: formattedContent,
        relevantFiles: data.relevantFiles
      }]);
    } catch (error) {
      console.error('Error getting AI response:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error. Please try again.' 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileClick = (filePath: string) => {
    if (!owner || !repo) return;
    navigate(`/workspace/${owner}/${repo}/file?path=${encodeURIComponent(filePath)}`);
  };

  const renderMessageContent = (content: string | SummaryJSON) => {
    if (typeof content === 'string') {
      return <p className={fontClass}>{content}</p>;
    }

    return (
      <div className={fontClass + " max-w-full break-words"}>
        <h2 className="text-2xl font-bold mb-2">{content.title}</h2>
        <div className="mb-4">
          <span className="block text-xl font-semibold mb-1">Main Purpose</span>
          <span>{content.mainPurpose}</span>
        </div>
        <div className="mb-4">
          <span className="block text-xl font-semibold mb-1">Key Components</span>
          <ol className="list-decimal ml-6">
            {content.keyComponents.map((comp, idx) => (
              <li key={idx} className="mb-1">
                <span className="font-bold">{comp.name}:</span> {comp.description}
              </li>
            ))}
          </ol>
        </div>
        <div>
          <span className="block text-xl font-semibold mb-1">Overall Structure</span>
          <span>{content.overallStructure}</span>
        </div>
      </div>
    );
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const chatButton = document.querySelector('[aria-label="Ask AI"]');
      const popover = document.querySelector('[role="dialog"]');
      if (chatRef.current && 
          !chatRef.current.contains(event.target as Node) && 
          !(chatButton && chatButton.contains(event.target as Node)) &&
          !(popover && popover.contains(event.target as Node))) {
        onOpenChange(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [onOpenChange]);

  if (!isOpen) return null;

  return (
    <div 
      ref={chatRef}
      className={`fixed right-0 top-14 bottom-0 bg-white dark:bg-gray-800 border-l border-gray-100 dark:border-gray-700 shadow-lg transition-all duration-300 ease-in-out transform ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      } w-[800px]`}
      style={{ transform: isOpen ? 'translateX(0)' : 'translateX(100%)' }}
    >
      <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700">
        <h2 className="text-xl font-display text-orange-700 dark:text-orange-400">Ask AI</h2>
        <button
          onClick={() => onOpenChange(false)}
          className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
        >
          ✕
        </button>
      </div>

      {showTips && <Tips onHide={() => setShowTips(false)} />}
      
      <ScrollArea className="h-[calc(100vh-14rem)]">
        <div className="p-4 space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  message.role === 'user'
                    ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-900 dark:text-orange-100'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                }`}
              >
                {renderMessageContent(message.content)}
                {message.relevantFiles && message.relevantFiles.length > 0 && (
                  <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    <p className="font-display">Relevant files:</p>
                    <ul className="list-disc list-inside">
                      {message.relevantFiles.map((file, i) => (
                        <li key={i} className="font-display">
                          <button
                            onClick={() => handleFileClick(file.filePath)}
                            className="text-orange-600 dark:text-orange-400 hover:text-orange-800 dark:hover:text-orange-300 hover:underline"
                          >
                            {file.filePath} ({(file.similarity * 100).toFixed(1)}% relevant)
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-3">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 space-y-3">
        <div className="flex items-center gap-2">
          <ContextPopover onSelect={handleContextSelect} />
        </div>
        
        {contexts.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {contexts.map((context, index) => (
              <div
                key={index}
                className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-1"
              >
                {getFileIcon(context.path, context.type)}
                <span className="text-sm text-gray-700 dark:text-gray-300">{context.path}</span>
                <button
                  onClick={() => handleRemoveContext(index)}
                  className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex space-x-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder="Ask anything about the code..."
            rows={1}
            style={{
              resize: 'none',
              minHeight: '44px',
              height: 'auto'
            }}
            className="flex-1 p-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-400 font-display text-lg overflow-hidden bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-4 py-2 bg-orange-500 dark:bg-orange-600 text-white rounded-lg hover:bg-orange-600 dark:hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed font-display text-lg self-end"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatModal; 