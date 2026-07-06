import Image from '@tiptap/extension-image';
import { ReactNodeViewRenderer } from '@tiptap/react';
import ImageNodeView from './ImageNodeView';

export const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: 100,
        parseHTML: (el) => {
          const dw = el.getAttribute('data-width');
          if (dw) return Number(dw);
          const w = el.getAttribute('width');
          if (w) return Number(w.replace('%', ''));
          const style = el.getAttribute('style');
          if (style) {
            const match = style.match(/width:\s*(\d+)%/);
            if (match) return Number(match[1]);
          }
          return 100;
        },
        renderHTML: (attrs) => {
          if (!attrs.width || attrs.width === 100) return {};
          return { style: `width:${attrs.width}%` };
        },
      },
      align: {
        default: 'inline',
        parseHTML: (el) => el.getAttribute('data-align') ?? 'inline',
        renderHTML: (attrs) => {
          if (!attrs.align || attrs.align === 'inline') return {};
          return { 'data-align': attrs.align };
        },
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView);
  },
});
