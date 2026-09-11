/**
 * Workflows that ship with the application.
 *
 * These are ordinary graphs. They run on the same runtime, through the same permission checks,
 * with nothing special about them — a demo that took a shortcut would be teaching the wrong
 * thing about what the product does.
 *
 * They are not filled in: each one names the folders it needs and leaves them empty, because a
 * demo that quietly wrote into a folder somebody did not choose is exactly the behaviour this
 * product exists to prevent.
 */

import type { EncastraGraph } from './types';

export interface Demo {
  readonly id: string;
  readonly name: string;
  readonly summary: string;
  /** What the person has to fill in before it can run. */
  readonly needs: readonly string[];
  readonly graph: EncastraGraph;
}

export const DEMOS: readonly Demo[] = [
  {
    id: 'image-processor',
    name: 'Image Processor',
    summary:
      'Watches a folder. Whenever an image appears, it makes a smaller copy in another folder.',
    needs: ['A folder to watch', 'A folder to save into'],
    graph: {
      nodes: {
        watch: {
          component: 'encastra.file.watch@1.0.0',
          config: { folder: '', extensions: 'png, jpg, jpeg, webp', existing: false },
          position: { x: 40, y: 180 },
        },
        resize: {
          component: 'encastra.image.resize@1.0.0',
          config: { width: 1280, height: 0, mode: 'contain', quality: 85 },
          position: { x: 320, y: 180 },
        },
        save: {
          component: 'encastra.file.save@1.0.0',
          config: { folder: '', suffix: '-small' },
          position: { x: 600, y: 180 },
        },
      },
      edges: [
        { from: { node: 'watch', port: 'file' }, to: { node: 'resize', port: 'image' } },
        { from: { node: 'resize', port: 'image' }, to: { node: 'save', port: 'file' } },
      ],
    },
  },
  {
    id: 'file-organiser',
    name: 'File Organiser',
    summary: 'Watches a folder and moves what lands in it into one of three others, by file type.',
    needs: ['A folder to watch', 'A folder for images', 'A folder for documents'],
    graph: {
      nodes: {
        watch: {
          component: 'encastra.file.watch@1.0.0',
          config: { folder: '', extensions: '', existing: false },
          position: { x: 40, y: 200 },
        },
        sort: {
          component: 'encastra.flow.switch@1.0.0',
          config: {
            case_a: 'png, jpg, jpeg, gif, webp, bmp, tiff',
            case_b: 'pdf, doc, docx, txt, md, rtf, odt',
            case_c: '',
          },
          position: { x: 320, y: 200 },
        },
        images: {
          component: 'encastra.file.move@1.0.0',
          config: { folder: '' },
          position: { x: 620, y: 100 },
        },
        documents: {
          component: 'encastra.file.move@1.0.0',
          config: { folder: '' },
          position: { x: 620, y: 300 },
        },
      },
      edges: [
        // The extension decides the route; the file itself is what travels along it.
        { from: { node: 'watch', port: 'extension' }, to: { node: 'sort', port: 'match' } },
        { from: { node: 'watch', port: 'file' }, to: { node: 'sort', port: 'value' } },
        { from: { node: 'sort', port: 'a' }, to: { node: 'images', port: 'file' } },
        { from: { node: 'sort', port: 'b' }, to: { node: 'documents', port: 'file' } },
      ],
    },
  },
  {
    id: 'thumbnail-sheet',
    name: 'Thumbnails',
    summary: 'Turns a folder of images into square previews, ready for a gallery or a grid.',
    needs: ['A folder to watch', 'A folder to save into'],
    graph: {
      nodes: {
        watch: {
          component: 'encastra.file.watch@1.0.0',
          config: { folder: '', extensions: 'png, jpg, jpeg, webp', existing: true },
          position: { x: 40, y: 180 },
        },
        thumb: {
          component: 'encastra.image.thumbnail@1.0.0',
          config: { size: 320, quality: 85 },
          position: { x: 320, y: 180 },
        },
        save: {
          component: 'encastra.file.save@1.0.0',
          config: { folder: '', suffix: '-thumb' },
          position: { x: 600, y: 180 },
        },
      },
      edges: [
        { from: { node: 'watch', port: 'file' }, to: { node: 'thumb', port: 'image' } },
        { from: { node: 'thumb', port: 'image' }, to: { node: 'save', port: 'file' } },
      ],
    },
  },
];
