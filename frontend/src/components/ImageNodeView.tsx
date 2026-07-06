'use client';

import { useState } from 'react';
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';

export default function ImageNodeView({ node, selected, deleteNode, editor, getPos }: NodeViewProps) {
  const [hovered, setHovered] = useState(false);

  const { src, alt, width, align } = node.attrs;

  const wrapperStyle: React.CSSProperties = { width: width !== 100 ? `${width}%` : undefined };
  if (align === 'left') {
    wrapperStyle.float = 'left';
    wrapperStyle.marginRight = '1rem';
  } else if (align === 'right') {
    wrapperStyle.float = 'right';
    wrapperStyle.marginLeft = '1rem';
  } else if (align === 'center') {
    wrapperStyle.display = 'block';
    wrapperStyle.margin = '0 auto';
  }

  return (
    <NodeViewWrapper
      className={align === 'inline' ? 'inline-block' : undefined}
      style={wrapperStyle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => {
        if (editor && getPos) {
          const pos = getPos();
          if (pos !== undefined) editor.commands.setNodeSelection(pos);
        }
      }}
    >
      <div className="relative">
        <img
          src={src}
          alt={alt || ''}
          className="block w-full h-auto rounded-lg"
          contentEditable={false}
          draggable
        />
        {(hovered || selected) && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              deleteNode();
            }}
            className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center text-xs hover:bg-red-500 transition"
            contentEditable={false}
          >
            ✕
          </button>
        )}
      </div>
    </NodeViewWrapper>
  );
}
