import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import Link from '@tiptap/extension-link'
import { TextStyle, Color } from '@tiptap/extension-text-style'
import Image from '@tiptap/extension-image'

// Extends the stock Image node with an optional `width` attribute serialised as
// an inline style so email clients respect the chosen size.
const ResizableImage = Image.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            width: {
                default: null,
                parseHTML: el => el.style.width || null,
                renderHTML: ({ width }) => width ? { style: `width:${width};height:auto;` } : {},
            },
        }
    },
})
import { Table, TableRow, TableHeader, TableCell } from '@tiptap/extension-table'
import { useEffect, useCallback, useRef, useState } from 'react'
import {
    Bold, Italic, Underline as UnderlineIcon, Strikethrough,
    List, ListOrdered, AlignLeft, AlignCenter, AlignRight,
    Link as LinkIcon, Link2Off, Undo2, Redo2, Eraser, Type,
    ImagePlus, Loader2, Table2,
    BetweenVerticalStart, BetweenVerticalEnd,
    BetweenHorizontalStart, BetweenHorizontalEnd,
    Rows3, Columns3, Trash2,
} from 'lucide-react'
import { cn } from '../lib/utils'
import api from '../lib/api'

const ToolbarBtn = ({ active, title, onClick, disabled, children }) => (
    <button
        type="button"
        title={title}
        disabled={disabled}
        onMouseDown={e => { e.preventDefault(); onClick?.() }}
        className={cn(
            'h-7 w-7 flex items-center justify-center rounded transition-colors',
            active
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900',
            disabled && 'opacity-35 pointer-events-none',
        )}
    >
        {children}
    </button>
)

const Sep = () => <div className="w-px h-5 bg-gray-300 mx-0.5 shrink-0" />

export default function RichTextEditor({ value, onChange, placeholder = 'Write your message here…', minHeight = 220 }) {
    const fileInputRef = useRef(null)
    const [uploading, setUploading] = useState(false)

    const editor = useEditor({
        extensions: [
            StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
            Underline,
            TextAlign.configure({ types: ['heading', 'paragraph', 'tableCell', 'tableHeader'] }),
            Link.configure({ openOnClick: false }),
            TextStyle,
            Color,
            ResizableImage.configure({ inline: false, allowBase64: false }),
            Table.configure({ resizable: false }),
            TableRow,
            TableHeader,
            TableCell,
        ],
        content: value || '',
        editorProps: {
            attributes: {
                class: 'rte-content px-4 py-3 text-sm text-gray-800 focus:outline-none',
                style: `min-height:${minHeight}px`,
            },
        },
        onUpdate: ({ editor }) => onChange?.(editor.getHTML()),
    })

    // Clear editor when parent resets value to ''
    useEffect(() => {
        if (!editor || value !== '' || editor.isEmpty) return
        editor.commands.clearContent(true)
    }, [value])     // eslint-disable-line react-hooks/exhaustive-deps

    const handleLink = useCallback(() => {
        if (!editor) return
        const prev = editor.getAttributes('link').href ?? ''
        const url = window.prompt('Enter URL (leave empty to remove):', prev)
        if (url === null) return
        url === ''
            ? editor.chain().focus().extendMarkRange('link').unsetLink().run()
            : editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
    }, [editor])

    const handleImageFile = useCallback(async (e) => {
        const file = e.target.files?.[0]
        if (!file || !editor) return
        e.target.value = ''
        setUploading(true)
        try {
            const fd = new FormData()
            fd.append('image', file)
            const res = await api.post('/settings/upload-editor-image', fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
            })
            const url = res.data?.data?.url
            if (url) editor.chain().focus().setImage({ src: url, alt: file.name }).run()
        } catch {
            // silently ignore
        }
        setUploading(false)
    }, [editor])

    if (!editor) return null

    const headingLevel = editor.isActive('heading', { level: 1 }) ? '1'
        : editor.isActive('heading', { level: 2 }) ? '2'
        : editor.isActive('heading', { level: 3 }) ? '3'
        : '0'

    const activeColor = editor.getAttributes('textStyle').color ?? '#000000'
    const inTable = editor.isActive('table')
    const inImage = editor.isActive('image')
    const imageWidth = editor.getAttributes('image').width ?? null

    return (
        <div className="border border-gray-200 rounded-xl overflow-hidden bg-white focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all">

            {/* ── Toolbar ── */}
            <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 bg-gray-50 border-b border-gray-200 select-none">

                {/* History */}
                <ToolbarBtn title="Undo (Ctrl+Z)" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>
                    <Undo2 size={13} />
                </ToolbarBtn>
                <ToolbarBtn title="Redo (Ctrl+Y)" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>
                    <Redo2 size={13} />
                </ToolbarBtn>

                <Sep />

                {/* Paragraph style */}
                <select
                    value={headingLevel}
                    onMouseDown={e => e.stopPropagation()}
                    onChange={e => {
                        const v = e.target.value
                        v === '0'
                            ? editor.chain().focus().setParagraph().run()
                            : editor.chain().focus().toggleHeading({ level: parseInt(v) }).run()
                    }}
                    className="h-7 text-xs border border-gray-300 rounded px-1.5 bg-white text-gray-700 focus:outline-none focus:border-blue-400 cursor-pointer"
                >
                    <option value="0">Normal</option>
                    <option value="1">Heading 1</option>
                    <option value="2">Heading 2</option>
                    <option value="3">Heading 3</option>
                </select>

                <Sep />

                {/* Text formatting */}
                <ToolbarBtn title="Bold (Ctrl+B)" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
                    <Bold size={13} />
                </ToolbarBtn>
                <ToolbarBtn title="Italic (Ctrl+I)" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
                    <Italic size={13} />
                </ToolbarBtn>
                <ToolbarBtn title="Underline (Ctrl+U)" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}>
                    <UnderlineIcon size={13} />
                </ToolbarBtn>
                <ToolbarBtn title="Strikethrough" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}>
                    <Strikethrough size={13} />
                </ToolbarBtn>

                <Sep />

                {/* Lists */}
                <ToolbarBtn title="Bullet List" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
                    <List size={13} />
                </ToolbarBtn>
                <ToolbarBtn title="Numbered List" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
                    <ListOrdered size={13} />
                </ToolbarBtn>

                <Sep />

                {/* Alignment */}
                <ToolbarBtn title="Align Left" active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()}>
                    <AlignLeft size={13} />
                </ToolbarBtn>
                <ToolbarBtn title="Align Center" active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()}>
                    <AlignCenter size={13} />
                </ToolbarBtn>
                <ToolbarBtn title="Align Right" active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()}>
                    <AlignRight size={13} />
                </ToolbarBtn>

                <Sep />

                {/* Link */}
                <ToolbarBtn title="Insert / Edit Link" active={editor.isActive('link')} onClick={handleLink}>
                    <LinkIcon size={13} />
                </ToolbarBtn>
                {editor.isActive('link') && (
                    <ToolbarBtn title="Remove Link" onClick={() => editor.chain().focus().unsetLink().run()}>
                        <Link2Off size={13} />
                    </ToolbarBtn>
                )}

                <Sep />

                {/* Image upload */}
                <ToolbarBtn title="Insert Image" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
                    {uploading ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />}
                </ToolbarBtn>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    className="sr-only"
                    onChange={handleImageFile}
                />

                {/* Image size presets — only when an image is selected */}
                {inImage && (<>
                    <Sep />
                    <span className="text-[10px] text-gray-400 font-semibold px-0.5 select-none">Img:</span>
                    {[['25%', '¼'], ['50%', '½'], ['75%', '¾'], ['100%', 'Full']].map(([w, label]) => (
                        <button
                            key={w}
                            type="button"
                            title={`Image width ${w}`}
                            onMouseDown={e => {
                                e.preventDefault()
                                editor.chain().focus().updateAttributes('image', { width: w }).run()
                            }}
                            className={cn(
                                'h-7 px-1.5 text-[10px] font-bold rounded transition-colors',
                                imageWidth === w
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900',
                            )}
                        >
                            {label}
                        </button>
                    ))}
                    <button
                        type="button"
                        title="Auto size (remove width)"
                        onMouseDown={e => {
                            e.preventDefault()
                            editor.chain().focus().updateAttributes('image', { width: null }).run()
                        }}
                        className={cn(
                            'h-7 px-1.5 text-[10px] font-bold rounded transition-colors',
                            imageWidth === null
                                ? 'bg-blue-100 text-blue-700'
                                : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900',
                        )}
                    >
                        Auto
                    </button>
                </>)}

                <Sep />

                {/* Table — insert button (always shown) */}
                <ToolbarBtn
                    title="Insert Table (3×3)"
                    active={inTable}
                    onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
                >
                    <Table2 size={13} />
                </ToolbarBtn>

                {/* Table context controls — only when cursor is inside a table */}
                {inTable && (<>
                    <Sep />
                    <ToolbarBtn title="Add Row Above" onClick={() => editor.chain().focus().addRowBefore().run()}>
                        <BetweenHorizontalStart size={13} />
                    </ToolbarBtn>
                    <ToolbarBtn title="Add Row Below" onClick={() => editor.chain().focus().addRowAfter().run()}>
                        <BetweenHorizontalEnd size={13} />
                    </ToolbarBtn>
                    <ToolbarBtn title="Delete Row" onClick={() => editor.chain().focus().deleteRow().run()}>
                        <Rows3 size={13} className="text-red-500" />
                    </ToolbarBtn>
                    <Sep />
                    <ToolbarBtn title="Add Column Before" onClick={() => editor.chain().focus().addColumnBefore().run()}>
                        <BetweenVerticalStart size={13} />
                    </ToolbarBtn>
                    <ToolbarBtn title="Add Column After" onClick={() => editor.chain().focus().addColumnAfter().run()}>
                        <BetweenVerticalEnd size={13} />
                    </ToolbarBtn>
                    <ToolbarBtn title="Delete Column" onClick={() => editor.chain().focus().deleteColumn().run()}>
                        <Columns3 size={13} className="text-red-500" />
                    </ToolbarBtn>
                    <Sep />
                    <ToolbarBtn title="Merge / Split Cells" onClick={() => editor.chain().focus().mergeOrSplit().run()}>
                        <span className="text-[10px] font-bold leading-none">M↔S</span>
                    </ToolbarBtn>
                    <ToolbarBtn title="Delete Table" onClick={() => editor.chain().focus().deleteTable().run()}>
                        <Trash2 size={13} className="text-red-500" />
                    </ToolbarBtn>
                </>)}

                <Sep />

                {/* Text color */}
                <label title="Text Color" className="h-7 w-7 flex items-center justify-center rounded cursor-pointer hover:bg-gray-200 transition-colors">
                    <span className="relative pointer-events-none">
                        <Type size={13} className="text-gray-600" />
                        <span
                            className="absolute left-0 right-0 -bottom-1.5 h-0.75 rounded-full"
                            style={{ background: activeColor }}
                        />
                    </span>
                    <input
                        type="color"
                        value={activeColor}
                        className="sr-only"
                        onChange={e => editor.chain().focus().setColor(e.target.value).run()}
                    />
                </label>

                <Sep />

                {/* Clear formatting */}
                <ToolbarBtn title="Clear Formatting" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}>
                    <Eraser size={13} />
                </ToolbarBtn>
            </div>

            {/* ── Editor area ── */}
            <EditorContent editor={editor} />
        </div>
    )
}
