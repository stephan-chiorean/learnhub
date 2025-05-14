import React, { useState, useRef, useEffect } from 'react';
import { SiOpenai } from 'react-icons/si';
import { useParams, useNavigate } from 'react-router-dom';
import ContextPopover, { getContextIcon } from './ContextPopover';
import { Lightbulb, BookOpen, Brain, StickyNote, GitBranch } from 'lucide-react';
import Tips from './ui/tips';
import { getFileIcon } from '../utils/fileIcons';

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

const fontClass = "font-['Gaegu'] text-lg text-gray-700";

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
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          namespace: `${owner}_${repo}`,
          question: userMessage,
          contexts: contexts.map(c => c.path)
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-30">
      <div className="bg-white rounded-lg w-full max-w-2xl h-[80vh] flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-xl font-['Gaegu'] text-orange-700">Ask AI</h2>
          <button
            onClick={() => onOpenChange(false)}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        {showTips && <Tips onHide={() => setShowTips(false)} />}
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  message.role === 'user'
                    ? 'bg-orange-100 text-orange-900'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                {renderMessageContent(message.content)}
                {message.relevantFiles && message.relevantFiles.length > 0 && (
                  <div className="mt-2 text-sm text-gray-600">
                    <p className="font-['Gaegu']">Relevant files:</p>
                    <ul className="list-disc list-inside">
                      {message.relevantFiles.map((file, i) => (
                        <li key={i} className="font-['Gaegu']">
                          <button
                            onClick={() => handleFileClick(file.filePath)}
                            className="text-orange-600 hover:text-orange-800 hover:underline"
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
              <div className="bg-gray-100 rounded-lg p-3">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 border-t space-y-3">
          <div className="flex items-center gap-2">
            <ContextPopover onSelect={handleContextSelect} />
          </div>
          
          {contexts.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {contexts.map((context, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-1"
                >
                  {getContextIcon(
                    context.path,
                    context.type,
                    context.metadata?.function_name
                  )}
                  <span className="text-sm text-gray-700">{context.path}</span>
                  <button
                    onClick={() => handleRemoveContext(index)}
                    className="text-gray-500 hover:text-gray-700"
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
                minHeight: '44px', // matches previous input height
                height: 'auto'
              }}
              className="flex-1 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 font-['Gaegu'] text-lg overflow-hidden"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed font-['Gaegu'] text-lg self-end"
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ChatModal; 