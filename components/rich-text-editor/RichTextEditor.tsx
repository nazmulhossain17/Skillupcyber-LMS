"use client"

import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import TextAlign from "@tiptap/extension-text-align"
import Underline from "@tiptap/extension-underline"
import Link from "@tiptap/extension-link"
import Heading from "@tiptap/extension-heading"
import BulletList from "@tiptap/extension-bullet-list"
import OrderedList from "@tiptap/extension-ordered-list"
import ListItem from "@tiptap/extension-list-item"
import {
  Bold,
  Italic,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo,
  Redo,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Heading1,
  Heading2,
  Heading3,
  Code,
  Quote,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

interface RichTextEditorProps {
  content: string
  onChange: (html: string) => void
  placeholder?: string
}

export function RichTextEditor({ content, onChange, placeholder = "Start typing..." }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false, // We'll use dedicated Heading extension
        bulletList: false, // We'll use dedicated BulletList extension
        orderedList: false, // We'll use dedicated OrderedList extension
        listItem: false, // We'll use dedicated ListItem extension
      }),
      Heading.configure({
        levels: [1, 2, 3],
      }),
      // Explicitly add list extensions
      BulletList.configure({
        HTMLAttributes: {
          class: 'list-disc list-outside ml-6',
        },
      }),
      OrderedList.configure({
        HTMLAttributes: {
          class: 'list-decimal list-outside ml-6',
        },
      }),
      ListItem,
      TextAlign.configure({ 
        types: ["heading", "paragraph"] 
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-primary underline underline-offset-4",
        },
      }),
    ],
    content,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: "prose prose-sm sm:prose lg:prose-lg xl:prose-xl focus:outline-none min-h-[300px] p-4 max-w-none",
      },
    },
  })

  if (!editor) {
    return (
      <div className="border rounded-lg overflow-hidden bg-background">
        <div className="border-b bg-muted/30 p-2 h-12 animate-pulse" />
        <div className="bg-background p-4 min-h-[300px]" />
      </div>
    )
  }

  return (
    <div className="border rounded-lg overflow-hidden bg-background">
      {/* Toolbar */}
      <div className="border-b bg-muted/30 p-2 flex flex-wrap gap-1 items-center">
        {/* Text Formatting */}
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant={editor.isActive("bold") ? "default" : "ghost"}
            onClick={(e) => {
              e.preventDefault()
              editor.chain().focus().toggleBold().run()
            }}
            title="Bold (Ctrl+B)"
            className="h-8 w-8 p-0"
          >
            <Bold className="h-4 w-4" />
          </Button>

          <Button
            type="button"
            size="sm"
            variant={editor.isActive("italic") ? "default" : "ghost"}
            onClick={(e) => {
              e.preventDefault()
              editor.chain().focus().toggleItalic().run()
            }}
            title="Italic (Ctrl+I)"
            className="h-8 w-8 p-0"
          >
            <Italic className="h-4 w-4" />
          </Button>

          <Button
            type="button"
            size="sm"
            variant={editor.isActive("strike") ? "default" : "ghost"}
            onClick={(e) => {
              e.preventDefault()
              editor.chain().focus().toggleStrike().run()
            }}
            title="Strikethrough"
            className="h-8 w-8 p-0"
          >
            <Strikethrough className="h-4 w-4" />
          </Button>

          <Button
            type="button"
            size="sm"
            variant={editor.isActive("underline") ? "default" : "ghost"}
            onClick={(e) => {
              e.preventDefault()
              editor.chain().focus().toggleUnderline().run()
            }}
            title="Underline (Ctrl+U)"
            className="h-8 w-8 p-0"
          >
            <UnderlineIcon className="h-4 w-4" />
          </Button>

          <Button
            type="button"
            size="sm"
            variant={editor.isActive("code") ? "default" : "ghost"}
            onClick={(e) => {
              e.preventDefault()
              editor.chain().focus().toggleCode().run()
            }}
            title="Inline Code"
            className="h-8 w-8 p-0"
          >
            <Code className="h-4 w-4" />
          </Button>
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Headings */}
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant={editor.isActive("heading", { level: 1 }) ? "default" : "ghost"}
            onClick={(e) => {
              e.preventDefault()
              editor.chain().focus().toggleHeading({ level: 1 }).run()
            }}
            title="Heading 1"
            className="h-8 w-8 p-0"
          >
            <Heading1 className="h-4 w-4" />
          </Button>

          <Button
            type="button"
            size="sm"
            variant={editor.isActive("heading", { level: 2 }) ? "default" : "ghost"}
            onClick={(e) => {
              e.preventDefault()
              editor.chain().focus().toggleHeading({ level: 2 }).run()
            }}
            title="Heading 2"
            className="h-8 w-8 p-0"
          >
            <Heading2 className="h-4 w-4" />
          </Button>

          <Button
            type="button"
            size="sm"
            variant={editor.isActive("heading", { level: 3 }) ? "default" : "ghost"}
            onClick={(e) => {
              e.preventDefault()
              editor.chain().focus().toggleHeading({ level: 3 }).run()
            }}
            title="Heading 3"
            className="h-8 w-8 p-0"
          >
            <Heading3 className="h-4 w-4" />
          </Button>
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Lists - ENHANCED WITH PROPER CONFIGURATION */}
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant={editor.isActive("bulletList") ? "default" : "ghost"}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              editor.chain().focus().toggleBulletList().run()
            }}
            title="Bullet List"
            className="h-8 w-8 p-0"
          >
            <List className="h-4 w-4" />
          </Button>

          <Button
            type="button"
            size="sm"
            variant={editor.isActive("orderedList") ? "default" : "ghost"}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              editor.chain().focus().toggleOrderedList().run()
            }}
            title="Numbered List"
            className="h-8 w-8 p-0"
          >
            <ListOrdered className="h-4 w-4" />
          </Button>

          <Button
            type="button"
            size="sm"
            variant={editor.isActive("blockquote") ? "default" : "ghost"}
            onClick={(e) => {
              e.preventDefault()
              editor.chain().focus().toggleBlockquote().run()
            }}
            title="Quote"
            className="h-8 w-8 p-0"
          >
            <Quote className="h-4 w-4" />
          </Button>
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Alignment */}
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant={editor.isActive({ textAlign: "left" }) ? "default" : "ghost"}
            onClick={(e) => {
              e.preventDefault()
              editor.chain().focus().setTextAlign("left").run()
            }}
            title="Align Left"
            className="h-8 w-8 p-0"
          >
            <AlignLeft className="h-4 w-4" />
          </Button>

          <Button
            type="button"
            size="sm"
            variant={editor.isActive({ textAlign: "center" }) ? "default" : "ghost"}
            onClick={(e) => {
              e.preventDefault()
              editor.chain().focus().setTextAlign("center").run()
            }}
            title="Align Center"
            className="h-8 w-8 p-0"
          >
            <AlignCenter className="h-4 w-4" />
          </Button>

          <Button
            type="button"
            size="sm"
            variant={editor.isActive({ textAlign: "right" }) ? "default" : "ghost"}
            onClick={(e) => {
              e.preventDefault()
              editor.chain().focus().setTextAlign("right").run()
            }}
            title="Align Right"
            className="h-8 w-8 p-0"
          >
            <AlignRight className="h-4 w-4" />
          </Button>
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Undo / Redo */}
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.preventDefault()
              editor.chain().focus().undo().run()
            }}
            disabled={!editor.can().undo()}
            title="Undo (Ctrl+Z)"
            className="h-8 w-8 p-0"
          >
            <Undo className="h-4 w-4" />
          </Button>

          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.preventDefault()
              editor.chain().focus().redo().run()
            }}
            disabled={!editor.can().redo()}
            title="Redo (Ctrl+Shift+Z)"
            className="h-8 w-8 p-0"
          >
            <Redo className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Editor Body */}
      <div className="bg-background">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}