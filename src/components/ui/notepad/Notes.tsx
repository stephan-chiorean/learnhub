import React, { useState } from 'react';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import BulletList from '@tiptap/extension-bullet-list';
import OrderedList from '@tiptap/extension-ordered-list';
import CodeBlock from '@tiptap/extension-code-block';
import Blockquote from '@tiptap/extension-blockquote';
import Heading from '@tiptap/extension-heading';
import { 
  Bold, 
  Italic, 
  List, 
  ListOrdered, 
  Heading1, 
  Heading2, 
  Code, 
  Quote, 
  Undo, 
  Redo 
} from 'lucide-react';

interface NotesProps {
  isExpanded: boolean;
}

const Notes: React.FC<NotesProps> = ({ isExpanded }) => {
  const [isFocused, setIsFocused] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        bulletList: false,
        orderedList: false,
        codeBlock: false,
        blockquote: false,
        }),
      Heading.configure({
        levels: [1, 2],
         HTMLAttributes: {
            1: { class: 'text-2xl font-bold' },
            2: { class: 'text-xl font-bold' }
          }
        }),
      Placeholder.configure({
        placeholder: 'Start typing your notes...',
      }),
      BulletList.configure({
        HTMLAttributes: {
          class: 'list-disc pl-4',
        },
      }),
      OrderedList.configure({
        HTMLAttributes: {
          class: 'list-decimal pl-4',
        },
      }),
      CodeBlock.configure({
        HTMLAttributes: {
          class: 'bg-gray-100 p-2 rounded-md',
        },
      }),
      Blockquote.configure({
        HTMLAttributes: {
          class: 'border-l-2 border-gray-300 pl-4 italic',
        },
      }),
    ],
    content: '',
    onFocus: () => setIsFocused(true),
    onBlur: () => setIsFocused(false),
    editorProps: {
      attributes: {
        class: 'font-display text-lg min-h-[calc(100vh-8rem)] focus:outline-none',
      },
      handleKeyDown: (view, event): boolean => {
        if (event.key === 'Tab') {
          event.preventDefault();
      
          if (!editor) return false;
      
          const isInList = editor.isActive('bulletList') || editor.isActive('orderedList');
      
          if (isInList) {
            if (event.shiftKey) {
              // Shift+Tab: outdent
              return editor.chain().focus().liftListItem('listItem').run();
            } else {
              // Tab: indent
              return editor.chain().focus().sinkListItem('listItem').run();
            }
          } else {
            // Not in list → insert tab character
            return editor.chain().focus().insertContent('\t').run();
          }
        }
      
        return false;
      },
    },
  });

  if (!editor) {
    return null;
  }

  const MenuBar = () => {
    return (
      <div 
        className={`flex items-center gap-1 p-2 border-b border-gray-100 transition-all duration-200`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onMouseDown={(e) => {
            e.preventDefault();
            editor.chain().focus().toggleBold().run();
          }}
          className={`p-2 rounded hover:bg-gray-100 ${
            editor.isActive('bold') ? 'bg-gray-100 text-orange-500' : ''
          }`}
          title="Bold"
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          onMouseDown={(e) => {
            e.preventDefault();
            editor.chain().focus().toggleItalic().run();
          }}
          className={`p-2 rounded hover:bg-gray-100 ${
            editor.isActive('italic') ? 'bg-gray-100 text-orange-500' : ''
          }`}
          title="Italic"
        >
          <Italic className="w-4 h-4" />
        </button>
        <div className="w-px h-6 bg-gray-200 mx-2" />
        <button
          onMouseDown={(e) => {
            e.preventDefault();
            editor.chain().focus().toggleBulletList().run();
          }}
          className={`p-2 rounded hover:bg-gray-100 ${
            editor.isActive('bulletList') ? 'bg-gray-100 text-orange-500' : ''
          }`}
          title="Bullet List"
        >
          <List className="w-4 h-4" />
        </button>
        <button
          onMouseDown={(e) => {
            e.preventDefault();
            editor.chain().focus().toggleOrderedList().run();
          }}
          className={`p-2 rounded hover:bg-gray-100 ${
            editor.isActive('orderedList') ? 'bg-gray-100 text-orange-500' : ''
          }`}
          title="Numbered List"
        >
          <ListOrdered className="w-4 h-4" />
        </button>
        <div className="w-px h-6 bg-gray-200 mx-2" />
        <button
          onMouseDown={(e) => {
            e.preventDefault();
            editor.chain().focus().toggleHeading({ level: 1 }).run();
          }}
          className={`p-2 rounded hover:bg-gray-100 ${
            editor.isActive('heading', { level: 1 }) ? 'bg-gray-100 text-orange-500' : ''
          }`}
          title="Heading 1"
        >
          <Heading1 className="w-4 h-4" />
        </button>
        <button
          onMouseDown={(e) => {
            e.preventDefault();
            editor.chain().focus().toggleHeading({ level: 2 }).run();
          }}
          className={`p-2 rounded hover:bg-gray-100 ${
            editor.isActive('heading', { level: 2 }) ? 'bg-gray-100 text-orange-500' : ''
          }`}
          title="Heading 2"
        >
          <Heading2 className="w-4 h-4" />
        </button>
        <button
          onMouseDown={(e) => {
            e.preventDefault();
            editor.chain().focus().toggleCodeBlock().run();
          }}
          className={`p-2 rounded hover:bg-gray-100 ${
            editor.isActive('codeBlock') ? 'bg-gray-100 text-orange-500' : ''
          }`}
          title="Code Block"
        >
          <Code className="w-4 h-4" />
        </button>
        <button
          onMouseDown={(e) => {
            e.preventDefault();
            editor.chain().focus().toggleBlockquote().run();
          }}
          className={`p-2 rounded hover:bg-gray-100 ${
            editor.isActive('blockquote') ? 'bg-gray-100 text-orange-500' : ''
          }`}
          title="Quote"
        >
          <Quote className="w-4 h-4" />
        </button>
        <div className="w-px h-6 bg-gray-200 mx-2" />
        <button
          onMouseDown={(e) => {
            e.preventDefault();
            editor.chain().focus().undo().run();
          }}
          className="p-2 rounded hover:bg-gray-100"
          title="Undo"
        >
          <Undo className="w-4 h-4" />
        </button>
        <button
          onMouseDown={(e) => {
            e.preventDefault();
            editor.chain().focus().redo().run();
          }}
          className="p-2 rounded hover:bg-gray-100"
          title="Redo"
        >
          <Redo className="w-4 h-4" />
        </button>
      </div>
    );
  };

  return (
    <div 
      className="h-full flex flex-col" 
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
    >
      <MenuBar />
      <div className="flex-1 overflow-auto">
        <EditorContent 
          editor={editor} 
          className="p-4 focus:outline-none"
        />
      </div>
    </div>
  );
};

export default Notes; 