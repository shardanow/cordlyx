'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import Mention from '@tiptap/extension-mention';
import { ResizableImage } from './ResizableImage';
import { useEffect, useCallback, useRef, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';

export interface AttachmentItem {
  url: string;
  originalFilename: string;
  mimeType: string;
}

export interface MentionMember {
  id: string;
  name: string;
  avatarUrl?: string | null;
}

interface RichEditorProps {
    content: string;
    onChange: (html: string) => void;
    placeholder?: string;
    minHeight?: string;
    autoFocus?: boolean;
    onImageUpload?: (file: File) => Promise<string>;
    attachments?: AttachmentItem[];
    members?: MentionMember[];
}

const TOOLBAR_CLASSES = 'flex flex-wrap gap-1 p-2 border-b border-border bg-muted/30';
const BTN = 'px-2 py-1 rounded text-xs hover:bg-muted transition font-medium';
const BTN_ACTIVE = 'bg-muted ring-1 ring-border';

const WIDTH_PRESETS = [25, 50, 75, 100];

export default function RichEditor({
    content,
    onChange,
    placeholder = 'Write something...',
    minHeight = '120px',
    autoFocus = false,
    onImageUpload,
    attachments = [],
    members = [],
}: RichEditorProps) {
    const fileRef = useRef<HTMLInputElement>(null);
    const [showImageMenu, setShowImageMenu] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const emojiBtnRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (!showEmojiPicker) return;
        function handle(e: MouseEvent) {
            if (emojiBtnRef.current && !emojiBtnRef.current.contains(e.target as Node)) {
                setShowEmojiPicker(false);
            }
        }
        document.addEventListener('mousedown', handle);
        return () => document.removeEventListener('mousedown', handle);
    }, [showEmojiPicker]);

    const EMOJIS = ['👍', '❤️', '😄', '🎉', '🚀', '👀', '👎', '😠', '🔥', '💯', '✅', '❌', '⭐', '💡', '📌', '🎯'];

    const imageAttachments = attachments.filter((a) => a.mimeType.startsWith('image/'));

    const mentionConfig = useMemo(() => {
        const memberList = members ?? [];
        return {
            items: ({ query }: { query: string }) =>
                memberList
                    .filter((m) => m.name.toLowerCase().includes(query.toLowerCase()))
                    .slice(0, 5),
            render: () => {
                let dom: HTMLDivElement | null = null;

                const renderItems = (items: MentionMember[], command: (item: { id: string; label: string }) => void) => {
                    if (!dom) return;
                    dom.innerHTML = items
                        .map(
                            (item, i) =>
                                `<button type="button" class="flex items-center gap-2 w-full text-left px-2 py-1.5 text-sm rounded bg-background hover:bg-muted ${i === 0 ? 'bg-muted' : ''}" data-index="${i}">
                                    <div class="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium shrink-0">${item.name.charAt(0).toUpperCase()}</div>
                                    <span>${item.name}</span>
                                </button>`,
                        )
                        .join('');

                    dom.querySelectorAll('button').forEach((btn) => {
                        btn.addEventListener('mousedown', (e) => {
                            e.preventDefault();
                            const idx = parseInt(btn.dataset.index ?? '0');
                            const selected = items[idx];
                            if (selected) command({ id: selected.id, label: selected.name });
                        });
                    });
                };

                return {
                    onStart: (props: any) => {
                        dom = document.createElement('div');
                        dom.className = 'fixed z-50 bg-popover border border-border rounded-lg shadow-lg p-1 max-h-48 overflow-y-auto min-w-[160px]';
                        document.body.appendChild(dom);
                        renderItems(props.items, props.command);
                        const rect = props.clientRect?.();
                        if (rect && dom) {
                            dom.style.left = `${rect.left}px`;
                            dom.style.top = `${rect.bottom + 4}px`;
                        }
                    },
                    onUpdate: (props: any) => {
                        renderItems(props.items, props.command);
                    },
                    onKeyDown: (props: any) => {
                        if (props.event.key === 'Escape') {
                            dom?.remove();
                            dom = null;
                            return true;
                        }
                        return false;
                    },
                    onExit: () => {
                        dom?.remove();
                        dom = null;
                    },
                };
            },
        };
    }, [members]);

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: { levels: [1, 2, 3] },
                bulletList: { keepMarks: true },
                orderedList: { keepMarks: true },
                link: false,
            }),
            TaskList,
            TaskItem.configure({ nested: true }),
            Placeholder.configure({ placeholder }),
            Link.configure({ openOnClick: false, HTMLAttributes: { class: 'text-primary underline cursor-pointer' } }),
            ResizableImage.configure({ HTMLAttributes: { class: 'max-w-full h-auto rounded-lg' } }),
            Table.configure({ resizable: true }),
            TableRow,
            TableCell,
            TableHeader,
            Mention.configure({
                HTMLAttributes: { class: 'mention text-primary font-medium' },
                renderHTML: ({ node }) =>
                    ['span', { 'data-type': 'mention', 'data-id': node.attrs.id, 'data-label': node.attrs.label, class: 'mention text-primary font-medium' }, `@${node.attrs.label ?? node.attrs.id}`],
                renderText: ({ node }) => `@${node.attrs.label ?? node.attrs.id}`,
                suggestion: mentionConfig,
            }),
        ],
        content,
        immediatelyRender: false,
        autofocus: autoFocus,
        onUpdate({ editor }) {
            onChange(editor.getHTML());
        },
        editorProps: {
            attributes: {
                class: 'prose prose-sm max-w-none p-3 focus:outline-none min-h-[var(--editor-min-h)]',
            },
        },
    });

    useEffect(() => {
        if (editor && content !== editor.getHTML()) {
            editor.commands.setContent(content);
        }
    }, [content]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!editor || !onImageUpload) return;
        const dom = editor.view.dom;
        const handlePaste = (e: ClipboardEvent) => {
            const files = e.clipboardData?.files;
            if (!files || files.length === 0) return;
            const imageFile = Array.from(files).find((f) => f.type.startsWith('image/'));
            if (!imageFile) return;
            e.preventDefault();
            onImageUpload(imageFile).then((url) => {
                editor.chain().focus().setImage({ src: url, width: 100 }).run();
            });
        };
        dom.addEventListener('paste', handlePaste);
        return () => dom.removeEventListener('paste', handlePaste);
    }, [editor, onImageUpload]);

    const setLink = useCallback(() => {
        const prev = editor?.getAttributes('link').href;
        const url = window.prompt('URL', prev ?? '');
        if (url === null) return;
        if (url === '') { editor?.chain().focus().extendMarkRange('link').unsetLink().run(); return; }
        editor?.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }, [editor]);

    const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !onImageUpload || !editor) return;
        const url = await onImageUpload(file);
        editor.chain().focus().setImage({ src: url, width: 100 }).run();
        setShowImageMenu(false);
        if (fileRef.current) fileRef.current.value = '';
    }, [editor, onImageUpload]);

    const insertImage = useCallback((url: string) => {
        if (!editor) return;
        editor.chain().focus().setImage({ src: url, width: 100 }).run();
        setShowImageMenu(false);
    }, [editor]);

    if (!editor) return null;

    return (
        <div
            className="border border-border rounded overflow-hidden"
            style={{ '--editor-min-h': minHeight } as React.CSSProperties}
        >
                <BubbleMenu
                    editor={editor}
                    updateDelay={0}
                    options={{ placement: 'top', offset: 8 }}
                    shouldShow={({ editor: ed }) => ed.isActive('image')}
                >
                    <div className="flex items-center gap-1 bg-background border border-border rounded-lg shadow-lg px-2 py-1.5 text-xs">
                        {WIDTH_PRESETS.map((w) => (
                            <button
                                key={w}
                                type="button"
                                onClick={() => editor.chain().focus().updateAttributes('image', { width: w }).run()}
                                className={`px-2 py-1 rounded hover:bg-muted transition font-medium ${
                                    editor.getAttributes('image').width === w ? 'bg-primary text-primary-foreground' : ''
                                }`}
                            >
                                {w}%
                            </button>
                        ))}
                        <div className="w-px h-4 bg-border mx-1" />
                        {(['left', 'center', 'right', 'inline'] as const).map((align) => (
                            <button
                                key={align}
                                type="button"
                                onClick={() => editor.chain().focus().updateAttributes('image', { align }).run()}
                                className={`px-2 py-1 rounded hover:bg-muted transition font-medium capitalize ${
                                    editor.getAttributes('image').align === align ? 'bg-primary text-primary-foreground' : ''
                                }`}
                            >
                                {align}
                            </button>
                        ))}
                        <div className="w-px h-4 bg-border mx-1" />
                        <button
                            type="button"
                            onClick={() => editor.chain().focus().deleteSelection().run()}
                            className="px-2 py-1 rounded hover:bg-destructive hover:text-destructive-foreground transition text-muted-foreground"
                        >
                            ✕ Delete
                        </button>
                    </div>
                </BubbleMenu>

                <BubbleMenu
                    editor={editor}
                    updateDelay={0}
                    options={{ placement: 'top', offset: 8 }}
                    shouldShow={({ editor: ed }) => ed.isActive('table')}
                >
                    <div className="flex items-center gap-1 bg-background border border-border rounded-lg shadow-lg px-2 py-1.5 text-xs">
                        <button type="button" onClick={() => editor.chain().focus().addRowBefore().run()} className={BTN} title="Row before">▲ Row</button>
                        <button type="button" onClick={() => editor.chain().focus().addRowAfter().run()} className={BTN} title="Row after">▼ Row</button>
                        <button type="button" onClick={() => editor.chain().focus().addColumnBefore().run()} className={BTN} title="Column before">◀ Col</button>
                        <button type="button" onClick={() => editor.chain().focus().addColumnAfter().run()} className={BTN} title="Column after">▶ Col</button>
                        <div className="w-px h-4 bg-border mx-1" />
                        <button type="button" onClick={() => editor.chain().focus().mergeCells().run()} className={BTN} title="Merge cells">⊞ Merge</button>
                        <button type="button" onClick={() => editor.chain().focus().splitCell().run()} className={BTN} title="Split cell">⊟ Split</button>
                        <div className="w-px h-4 bg-border mx-1" />
                        <button type="button" onClick={() => editor.chain().focus().deleteRow().run()} className={BTN + ' hover:text-destructive'} title="Delete row">✕ Row</button>
                        <button type="button" onClick={() => editor.chain().focus().deleteColumn().run()} className={BTN + ' hover:text-destructive'} title="Delete column">✕ Col</button>
                        <button type="button" onClick={() => editor.chain().focus().deleteTable().run()} className="px-2 py-1 rounded hover:bg-destructive hover:text-destructive-foreground transition text-muted-foreground" title="Delete table">✕ Table</button>
                    </div>
                </BubbleMenu>

            {/* Toolbar */}
            <div className={TOOLBAR_CLASSES}>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    className={`${BTN} ${editor.isActive('bold') ? BTN_ACTIVE : ''}`}
                    title="Bold (Ctrl+B)"
                >
                    <strong>B</strong>
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    className={`${BTN} ${editor.isActive('italic') ? BTN_ACTIVE : ''}`}
                    title="Italic (Ctrl+I)"
                >
                    <em>I</em>
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleStrike().run()}
                    className={`${BTN} ${editor.isActive('strike') ? BTN_ACTIVE : ''}`}
                    title="Strikethrough"
                >
                    <s>S</s>
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleCode().run()}
                    className={`${BTN} font-mono ${editor.isActive('code') ? BTN_ACTIVE : ''}`}
                    title="Inline code"
                >
                    {'</>'}
                </button>

                <div className="w-px bg-border mx-1" />

                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                    className={`${BTN} ${editor.isActive('heading', { level: 2 }) ? BTN_ACTIVE : ''}`}
                    title="Heading 2"
                >
                    H2
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                    className={`${BTN} ${editor.isActive('heading', { level: 3 }) ? BTN_ACTIVE : ''}`}
                    title="Heading 3"
                >
                    H3
                </button>

                <div className="w-px bg-border mx-1" />

                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    className={`${BTN} ${editor.isActive('bulletList') ? BTN_ACTIVE : ''}`}
                    title="Bullet list"
                >
                    • List
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    className={`${BTN} ${editor.isActive('orderedList') ? BTN_ACTIVE : ''}`}
                    title="Ordered list"
                >
                    1. List
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleTaskList().run()}
                    className={`${BTN} ${editor.isActive('taskList') ? BTN_ACTIVE : ''}`}
                    title="Task list"
                >
                    ☐
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleBlockquote().run()}
                    className={`${BTN} ${editor.isActive('blockquote') ? BTN_ACTIVE : ''}`}
                    title="Quote"
                >
                    ❝
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                    className={`${BTN} font-mono ${editor.isActive('codeBlock') ? BTN_ACTIVE : ''}`}
                    title="Code block"
                >
                    {'{ }'}
                </button>

                <div className="relative">
                    <button
                        ref={emojiBtnRef}
                        type="button"
                        onClick={() => setShowEmojiPicker((v) => !v)}
                        className={BTN}
                        title="Insert emoji"
                    >
                        😊
                    </button>
                    {showEmojiPicker && typeof window === 'object' && createPortal(
                        <div
                            className="fixed z-[9999] bg-background border border-border rounded-lg shadow-xl p-2 grid grid-cols-4 gap-1 min-w-[200px]"
                            style={{
                                top: emojiBtnRef.current?.getBoundingClientRect().bottom! + 4,
                                left: emojiBtnRef.current?.getBoundingClientRect().left!,
                            }}
                        >
                            {EMOJIS.map((emoji) => (
                                <button
                                    key={emoji}
                                    type="button"
                                    onMouseDown={() => { editor.chain().focus().insertContent(emoji).run(); setShowEmojiPicker(false); }}
                                    className="w-8 h-8 flex items-center justify-center rounded hover:bg-muted text-lg"
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>,
                        document.body,
                    )}
                </div>

                <div className="relative">
                    <button
                        type="button"
                        onClick={() => setShowImageMenu((v) => !v)}
                        className={`${BTN} ${editor.isActive('image') ? BTN_ACTIVE : ''}`}
                        title="Insert image"
                    >
                        🖼 {imageAttachments.length > 0 ? '▾' : ''}
                    </button>
                    {showImageMenu && (
                        <div className="absolute top-full left-0 mt-1 bg-background border border-border rounded-lg shadow-xl z-50 p-2 min-w-[200px]">
                            <button
                                type="button"
                                onClick={() => fileRef.current?.click()}
                                className="w-full text-left px-3 py-2 rounded text-xs hover:bg-muted transition font-medium"
                            >
                                Upload new
                            </button>
                            {imageAttachments.length > 0 && (
                                <>
                                    <div className="h-px bg-border my-1" />
                                    <div className="text-[10px] text-muted-foreground px-3 pb-1 font-medium">
                                        From attachments
                                    </div>
                                    <div className="grid grid-cols-3 gap-1 max-h-[200px] overflow-y-auto">
                                        {imageAttachments.map((att, i) => (
                                            <button
                                                key={i}
                                                type="button"
                                                onClick={() => insertImage(att.url)}
                                                className="block rounded overflow-hidden border border-border hover:ring-2 ring-primary transition"
                                            >
                                                <img
                                                    src={att.url}
                                                    alt={att.originalFilename}
                                                    className="w-full h-16 object-cover"
                                                />
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                    <input ref={fileRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                </div>

                <div className="w-px bg-border mx-1" />

                <button
                    type="button"
                    onClick={() => editor.chain().focus().setHorizontalRule().run()}
                    className={BTN}
                    title="Horizontal rule"
                >
                    —
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
                    className={BTN}
                    title="Clear formatting"
                >
                    Tx
                </button>

                <div className="w-px bg-border mx-1" />

                <button
                    type="button"
                    onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
                    className={BTN}
                    title="Insert table"
                >
                    ▦ Tbl
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().insertContent('@').run()}
                    className={BTN}
                    title="Mention @user"
                >
                    @
                </button>

                <div className="w-px bg-border mx-1" />

                <button
                    type="button"
                    onClick={setLink}
                    className={`${BTN} ${editor.isActive('link') ? BTN_ACTIVE : ''}`}
                    title="Insert link"
                >
                    Link
                </button>

                <div className="w-px bg-border mx-1" />

                <button
                    type="button"
                    onClick={() => editor.chain().focus().undo().run()}
                    disabled={!editor.can().undo()}
                    className={`${BTN} disabled:opacity-30`}
                    title="Undo (Ctrl+Z)"
                >
                    ↩
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().redo().run()}
                    disabled={!editor.can().redo()}
                    className={`${BTN} disabled:opacity-30`}
                    title="Redo (Ctrl+Y)"
                >
                    ↪
                </button>
            </div>

            <EditorContent editor={editor} />
        </div>
    );
}
