import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Tag, Input } from 'antd';
import { PlusOutlined } from '@ant-design/icons';

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
}

const TABS = ["Note", "Snippet"];

const AnnotationModal: React.FC<AnnotationModalProps> = ({
  isOpen,
  onClose,
  onSave,
  selection,
}) => {
  const [activeTab, setActiveTab] = useState<string>('Note');
  const [noteContent, setNoteContent] = useState('');
  const [snippetName, setSnippetName] = useState('');
  const [snippetDescription, setSnippetDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [inputVisible, setInputVisible] = useState(false);
  const [inputValue, setInputValue] = useState('');

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
    if (activeTab === 'Note') {
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
    } else {
      if (snippetName.trim()) {
        onSave({
          type: 'snippet',
          name: snippetName,
          description: snippetDescription,
          text: selection?.text,
          startLine: selection?.startLine,
          endLine: selection?.endLine,
          filePath: selection?.filePath,
        });
        setSnippetName('');
        setSnippetDescription('');
        onClose();
      }
    }
  };

  if (!selection) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] bg-white border-orange-200">
        <DialogHeader>
          <DialogTitle className="text-orange-600">Add {activeTab}</DialogTitle>
        </DialogHeader>
        <div className="flex gap-2 mb-4">
          {TABS.map(tab => (
            <button
              key={tab}
              className={`flex-1 py-2 rounded-t-lg text-base font-medium transition-colors focus:outline-none ${
                activeTab === tab
                  ? 'bg-orange-50 border-b-2 border-orange-500 text-orange-700'
                  : 'text-gray-500 hover:text-orange-600'
              }`}
              style={{ borderBottom: activeTab === tab ? '2px solid #f97316' : '2px solid transparent' }}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label className="text-gray-700">Selected Code</Label>
            <div className="p-2 bg-gray-50 rounded-md text-sm font-mono border border-gray-200">
              {selection.text}
            </div>
          </div>
          {activeTab === 'Note' && (
            <>
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
            </>
          )}
          {activeTab === 'Snippet' && (
            <>
              <div className="space-y-2">
                <Label className="text-gray-700">Snippet Name</Label>
                <input
                  type="text"
                  value={snippetName}
                  onChange={e => setSnippetName(e.target.value)}
                  placeholder="Enter a name for your snippet"
                  className="w-full rounded border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-orange-400"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-700">Description (optional)</Label>
                <Textarea
                  value={snippetDescription}
                  onChange={e => setSnippetDescription(e.target.value)}
                  placeholder="Add a description..."
                  className="min-h-[60px] border-gray-200 focus:border-orange-300 focus:ring-orange-200"
                />
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-gray-200 hover:bg-gray-50">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="bg-orange-500 hover:bg-orange-600 text-white"
            disabled={activeTab === 'Note' ? !noteContent.trim() : !snippetName.trim()}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AnnotationModal; 