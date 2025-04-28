import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Tag, Input } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { Copy, Check } from 'lucide-react';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { docco } from 'react-syntax-highlighter/dist/esm/styles/hljs';

interface AnnotationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  selection: {
    text: string;
    startLine: number;
    endLine: number;
    filePath: string;
  } | null;
  editingNote?: {
    content: string;
    tags: string[];
  };
}

const AnnotationModal: React.FC<AnnotationModalProps> = ({
  isOpen,
  onClose,
  onSave,
  selection,
  editingNote,
}) => {
  const [noteContent, setNoteContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [inputVisible, setInputVisible] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (editingNote) {
      setNoteContent(editingNote.content);
      setTags(editingNote.tags || []);
    } else {
      setNoteContent('');
      setTags([]);
    }
  }, [editingNote]);

  const handleClose = (removedTag: string) => {
    const newTags = tags.filter(tag => tag !== removedTag);
    setTags(newTags);
  };

  const showInput = () => {
    setInputVisible(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleInputConfirm = () => {
    if (inputValue && tags.indexOf(inputValue) === -1) {
      setTags([...tags, inputValue]);
    }
    setInputVisible(false);
    setInputValue('');
  };

  const handleSave = () => {
    if (noteContent.trim()) {
      onSave({
        type: 'note',
        text: selection?.text,
        content: noteContent,
        startLine: selection?.startLine,
        endLine: selection?.endLine,
        filePath: selection?.filePath,
        tags: tags,
      });
      setNoteContent('');
      setTags([]);
      onClose();
    }
  };

  const handleCopy = () => {
    if (selection?.text) {
      navigator.clipboard.writeText(selection.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!selection) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[1200px] bg-white border-orange-200">
        <DialogHeader>
          <DialogTitle className="text-orange-600">
            {editingNote ? 'Edit Note' : 'Add Note'}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label className="text-gray-700">Selected Code</Label>
            <div className="relative bg-gray-50 rounded-md border border-gray-200">
              <button
                onClick={handleCopy}
                className="absolute top-2 right-2 p-1 hover:bg-gray-100 rounded transition-colors z-10"
                title="Copy code"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-600" />
                ) : (
                  <Copy className="w-4 h-4 text-gray-500" />
                )}
              </button>
              <SyntaxHighlighter
                language="javascript"
                style={docco}
                customStyle={{ 
                  margin: 0, 
                  padding: '1rem',
                  background: 'transparent',
                  overflowX: 'auto'
                }}
                showLineNumbers={false}
              >
                {selection.text}
              </SyntaxHighlighter>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-gray-700">Your Note</Label>
            <Textarea
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="Add your note here..."
              className="min-h-[100px] border-gray-200 focus:border-orange-300 focus:ring-orange-200 font-['Gaegu'] text-lg leading-tight"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-gray-700">Tags</Label>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag, index) => (
                <Tag
                  key={tag}
                  closable
                  onClose={() => handleClose(tag)}
                  className="bg-orange-50 text-orange-700 border-orange-200"
                >
                  {tag}
                </Tag>
              ))}
              {inputVisible ? (
                <Input
                  type="text"
                  size="small"
                  className="w-20"
                  value={inputValue}
                  onChange={handleInputChange}
                  onBlur={handleInputConfirm}
                  onPressEnter={handleInputConfirm}
                />
              ) : (
                <Tag
                  onClick={showInput}
                  className="bg-orange-50 text-orange-700 border-orange-200 cursor-pointer"
                >
                  <PlusOutlined /> New Tag
                </Tag>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-['Gaegu'] text-lg shadow-md hover:shadow-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-['Gaegu'] text-lg shadow-md hover:shadow-lg"
            disabled={!noteContent.trim()}
          >
            Add Note
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AnnotationModal; 