/**
 * GENERATED — do not edit by hand.
 *
 * Source: crates/encastra-builtins/src/*.rs (the manifests the runtime actually parses).
 * Regenerate: node apps/web/scripts/generate-components.mjs
 *
 * 19 components + 2 triggers, counted from the manifests.
 */

import type { ComponentRecord } from './components.types';

export const COMPONENT_COUNT = 19;
export const TRIGGER_COUNT = 2;

export const COMPONENTS: readonly ComponentRecord[] = [
  {
    id: 'encastra.data.csv.read',
    version: '1.0.0',
    name: 'Read CSV',
    description: 'Turns comma-separated text into a list of rows.',
    category: 'data',
    isTrigger: false,
    inputs: [
      {
        key: 'text',
        label: 'text',
        type: 'string',
        required: true,
      },
    ],
    outputs: [
      {
        key: 'rows',
        label: 'Rows',
        type: 'json',
      },
      {
        key: 'count',
        label: 'How many',
        type: 'i64',
      },
    ],
    config: [
      {
        key: 'header',
        label: 'First row is a header',
        type: 'bool',
        required: false,
        doc: null,
      },
      {
        key: 'separator',
        label: 'Separator',
        type: 'string',
        required: false,
        doc: 'One character. Defaults to a comma; use a semicolon or a tab if that is what the file has.',
      },
    ],
    capabilities: [],
    platforms: ['windows', 'macos', 'linux'],
    sourceFile: 'crates/encastra-builtins/src/data.rs',
  },
  {
    id: 'encastra.data.csv.write',
    version: '1.0.0',
    name: 'Write CSV',
    description: 'Turns a list of rows into comma-separated text.',
    category: 'data',
    isTrigger: false,
    inputs: [
      {
        key: 'rows',
        label: 'Rows',
        type: 'json',
        required: true,
      },
    ],
    outputs: [
      {
        key: 'text',
        label: 'text',
        type: 'string',
      },
    ],
    config: [
      {
        key: 'header',
        label: 'Write a header row',
        type: 'bool',
        required: false,
        doc: null,
      },
      {
        key: 'separator',
        label: 'Separator',
        type: 'string',
        required: false,
        doc: null,
      },
    ],
    capabilities: [],
    platforms: ['windows', 'macos', 'linux'],
    sourceFile: 'crates/encastra-builtins/src/data.rs',
  },
  {
    id: 'encastra.data.json',
    version: '1.0.0',
    name: 'Parse JSON',
    description: 'Turns text into structured data.',
    category: 'data',
    isTrigger: false,
    inputs: [
      {
        key: 'text',
        label: 'text',
        type: 'string',
        required: true,
      },
    ],
    outputs: [
      {
        key: 'json',
        label: 'json',
        type: 'json',
      },
    ],
    config: [],
    capabilities: [],
    platforms: ['windows', 'macos', 'linux'],
    sourceFile: 'crates/encastra-builtins/src/data.rs',
  },
  {
    id: 'encastra.data.json.write',
    version: '1.0.0',
    name: 'Write JSON',
    description: 'Turns structured data back into text.',
    category: 'data',
    isTrigger: false,
    inputs: [
      {
        key: 'json',
        label: 'json',
        type: 'json',
        required: true,
      },
    ],
    outputs: [
      {
        key: 'text',
        label: 'text',
        type: 'string',
      },
    ],
    config: [
      {
        key: 'indent',
        label: 'Readable',
        type: 'bool',
        required: false,
        doc: 'Lay it out over several lines instead of one.',
      },
    ],
    capabilities: [],
    platforms: ['windows', 'macos', 'linux'],
    sourceFile: 'crates/encastra-builtins/src/data.rs',
  },
  {
    id: 'encastra.file.move',
    version: '1.0.0',
    name: 'Move File',
    description: 'Moves a file into another folder. The original is removed.',
    category: 'file',
    isTrigger: false,
    inputs: [
      {
        key: 'file',
        label: 'File',
        type: 'file',
        required: true,
      },
    ],
    outputs: [
      {
        key: 'file',
        label: 'Moved file',
        type: 'file',
      },
    ],
    config: [
      {
        key: 'folder',
        label: 'Move into',
        type: 'string',
        required: true,
        doc: 'Both this folder and the one the file comes from must be allowed, because a move deletes the original.',
      },
      {
        key: 'filename',
        label: 'New name',
        type: 'string',
        required: false,
        doc: 'Leave empty to keep the name it already has.',
      },
    ],
    capabilities: [
      {
        kind: 'fs.write',
        scope: 'chosen-folder',
        reason:
          'Moves the file, which means writing it to the new folder and deleting it from the old one.',
      },
    ],
    platforms: ['windows', 'macos', 'linux'],
    sourceFile: 'crates/encastra-builtins/src/files.rs',
  },
  {
    id: 'encastra.file.read',
    version: '1.0.0',
    name: 'Read File',
    description: 'Reads the text content of the file connected to it.',
    category: 'file',
    isTrigger: false,
    inputs: [
      {
        key: 'file',
        label: 'File',
        type: 'file',
        required: true,
      },
    ],
    outputs: [
      {
        key: 'text',
        label: 'Text',
        type: 'string',
      },
      {
        key: 'name',
        label: 'File name',
        type: 'string',
      },
    ],
    config: [],
    capabilities: [
      {
        kind: 'fs.read',
        scope: 'input-handles',
        reason: 'Reads the file you connect to this node, and nothing else.',
      },
    ],
    platforms: ['windows', 'macos', 'linux'],
    sourceFile: 'crates/encastra-builtins/src/files.rs',
  },
  {
    id: 'encastra.file.rename',
    version: '1.0.0',
    name: 'Rename File',
    description: 'Gives a file a new name, leaving it where it is.',
    category: 'file',
    isTrigger: false,
    inputs: [
      {
        key: 'file',
        label: 'File',
        type: 'file',
        required: true,
      },
      {
        key: 'name',
        label: 'New name',
        type: 'string',
        required: false,
      },
    ],
    outputs: [
      {
        key: 'file',
        label: 'Renamed file',
        type: 'file',
      },
    ],
    config: [
      {
        key: 'folder',
        label: 'Folder',
        type: 'string',
        required: true,
        doc: 'The folder the file is in. It must be allowed, because renaming removes the old name.',
      },
      {
        key: 'pattern',
        label: 'Name pattern',
        type: 'string',
        required: false,
        doc: 'Use {name} for the current name without its extension and {ext} for the extension.',
      },
    ],
    capabilities: [
      {
        kind: 'fs.write',
        scope: 'chosen-folder',
        reason:
          'Renames a file in the folder you pick, which means writing the new name and removing the old one.',
      },
    ],
    platforms: ['windows', 'macos', 'linux'],
    sourceFile: 'crates/encastra-builtins/src/files.rs',
  },
  {
    id: 'encastra.file.save',
    version: '1.0.0',
    name: 'Save File',
    description:
      'Puts a file into a folder you choose. Keeps the original name unless you give one.',
    category: 'file',
    isTrigger: false,
    inputs: [
      {
        key: 'file',
        label: 'File',
        type: 'file',
        required: true,
      },
    ],
    outputs: [
      {
        key: 'file',
        label: 'Saved file',
        type: 'file',
      },
    ],
    config: [
      {
        key: 'folder',
        label: 'Folder',
        type: 'string',
        required: true,
        doc: 'Where to save. You are asked to allow this folder before the first run.',
      },
      {
        key: 'filename',
        label: 'File name',
        type: 'string',
        required: false,
        doc: 'Leave empty to keep the name the file already has.',
      },
      {
        key: 'suffix',
        label: 'Add to the name',
        type: 'string',
        required: false,
        doc: 'Appended before the extension, so photo.png becomes photo-small.png.',
      },
    ],
    capabilities: [
      {
        kind: 'fs.write',
        scope: 'chosen-folder',
        reason: 'Saves the file into the folder you pick. It cannot write anywhere else.',
      },
    ],
    platforms: ['windows', 'macos', 'linux'],
    sourceFile: 'crates/encastra-builtins/src/files.rs',
  },
  {
    id: 'encastra.file.watch',
    version: '1.0.0',
    name: 'Watch Folder',
    description: 'Starts the workflow whenever a file appears in a folder.',
    category: 'file',
    isTrigger: true,
    inputs: [],
    outputs: [
      {
        key: 'file',
        label: 'The new file',
        type: 'file',
      },
      {
        key: 'name',
        label: 'Its name',
        type: 'string',
      },
      {
        key: 'extension',
        label: 'Its extension',
        type: 'string',
      },
    ],
    config: [
      {
        key: 'folder',
        label: 'Watch this folder',
        type: 'string',
        required: true,
        doc: 'Only this folder, not the ones inside it.',
      },
      {
        key: 'extensions',
        label: 'Only these kinds',
        type: 'string',
        required: false,
        doc: 'A list separated by commas, for example: png, jpg, jpeg. Leave empty for every file.',
      },
      {
        key: 'existing',
        label: 'Include files already there',
        type: 'bool',
        required: false,
        doc: 'Off by default, so starting a workflow does not immediately process a folder full of old files.',
      },
    ],
    capabilities: [
      {
        kind: 'fs.read',
        scope: 'watched-folder',
        reason: 'Watches the folder you pick and reads the files that appear in it.',
      },
    ],
    platforms: ['windows', 'macos', 'linux'],
    sourceFile: 'crates/encastra-builtins/src/triggers.rs',
  },
  {
    id: 'encastra.file.write',
    version: '1.0.0',
    name: 'Write File',
    description: 'Saves text into a file in a folder you choose.',
    category: 'file',
    isTrigger: false,
    inputs: [
      {
        key: 'content',
        label: 'content',
        type: 'string',
        required: true,
      },
    ],
    outputs: [
      {
        key: 'saved',
        label: 'Saved',
        type: 'bool',
      },
      {
        key: 'file',
        label: 'Saved file',
        type: 'file',
      },
    ],
    config: [
      {
        key: 'folder',
        label: 'Folder',
        type: 'string',
        required: true,
        doc: 'Where to save. You are asked to allow this folder before the first run.',
      },
      {
        key: 'filename',
        label: 'File name',
        type: 'string',
        required: true,
        doc: null,
      },
    ],
    capabilities: [
      {
        kind: 'fs.write',
        scope: 'chosen-folder',
        reason: 'Saves the result into the folder you pick. It cannot write anywhere else.',
      },
    ],
    platforms: ['windows', 'macos', 'linux'],
    sourceFile: 'crates/encastra-builtins/src/files.rs',
  },
  {
    id: 'encastra.flow.delay',
    version: '1.0.0',
    name: 'Delay',
    description: 'Waits, then passes the value on unchanged.',
    category: 'flow',
    isTrigger: false,
    inputs: [
      {
        key: 'value',
        label: 'value',
        type: 'json',
        required: true,
      },
    ],
    outputs: [
      {
        key: 'value',
        label: 'value',
        type: 'json',
      },
    ],
    config: [
      {
        key: 'seconds',
        label: 'Wait for',
        type: 'i64',
        required: true,
        doc: 'In seconds. Stopping the run interrupts the wait.',
      },
    ],
    capabilities: [],
    platforms: ['windows', 'macos', 'linux'],
    sourceFile: 'crates/encastra-builtins/src/flow.rs',
  },
  {
    id: 'encastra.flow.if',
    version: '1.0.0',
    name: 'If',
    description: 'Sends the value one way or the other depending on a condition.',
    category: 'flow',
    isTrigger: false,
    inputs: [
      {
        key: 'condition',
        label: 'condition',
        type: 'bool',
        required: true,
      },
      {
        key: 'value',
        label: 'value',
        type: 'json',
        required: true,
      },
    ],
    outputs: [
      {
        key: 'then',
        label: 'If true',
        type: 'option<json>',
      },
      {
        key: 'else',
        label: 'If false',
        type: 'option<json>',
      },
    ],
    config: [],
    capabilities: [],
    platforms: ['windows', 'macos', 'linux'],
    sourceFile: 'crates/encastra-builtins/src/flow.rs',
  },
  {
    id: 'encastra.flow.switch',
    version: '1.0.0',
    name: 'Switch',
    description: 'Sends the value down one of several routes depending on a word.',
    category: 'flow',
    isTrigger: false,
    inputs: [
      {
        key: 'match',
        label: 'Compare this',
        type: 'string',
        required: true,
      },
      {
        key: 'value',
        label: 'Send this',
        type: 'json',
        required: true,
      },
    ],
    outputs: [
      {
        key: 'a',
        label: 'Route A',
        type: 'option<json>',
      },
      {
        key: 'b',
        label: 'Route B',
        type: 'option<json>',
      },
      {
        key: 'c',
        label: 'Route C',
        type: 'option<json>',
      },
      {
        key: 'other',
        label: 'Anything else',
        type: 'option<json>',
      },
    ],
    config: [
      {
        key: 'case_a',
        label: 'Route A matches',
        type: 'string',
        required: false,
        doc: 'A list separated by commas, for example: png, jpg, jpeg, webp',
      },
      {
        key: 'case_b',
        label: 'Route B matches',
        type: 'string',
        required: false,
        doc: null,
      },
      {
        key: 'case_c',
        label: 'Route C matches',
        type: 'string',
        required: false,
        doc: null,
      },
    ],
    capabilities: [],
    platforms: ['windows', 'macos', 'linux'],
    sourceFile: 'crates/encastra-builtins/src/flow.rs',
  },
  {
    id: 'encastra.image.convert',
    version: '1.0.0',
    name: 'Convert Image',
    description: 'Writes an image in a different format.',
    category: 'media',
    isTrigger: false,
    inputs: [
      {
        key: 'image',
        label: 'Image',
        type: 'image',
        required: true,
      },
    ],
    outputs: [
      {
        key: 'image',
        label: 'Converted',
        type: 'image',
      },
    ],
    config: [
      {
        key: 'format',
        label: 'Format',
        type: 'string',
        required: true,
        doc: null,
      },
      {
        key: 'quality',
        label: 'JPEG quality',
        type: 'i64',
        required: false,
        doc: 'Ignored by PNG and WebP, which are written without loss here.',
      },
    ],
    capabilities: [
      {
        kind: 'fs.read',
        scope: 'input-handles',
        reason: 'Reads the image you connect to this node, and nothing else.',
      },
    ],
    platforms: ['windows', 'macos', 'linux'],
    sourceFile: 'crates/encastra-builtins/src/media.rs',
  },
  {
    id: 'encastra.image.info',
    version: '1.0.0',
    name: 'Image Info',
    description: "Reports an image's size and format without changing it.",
    category: 'media',
    isTrigger: false,
    inputs: [
      {
        key: 'image',
        label: 'Image',
        type: 'image',
        required: true,
      },
    ],
    outputs: [
      {
        key: 'width',
        label: 'Width',
        type: 'i64',
      },
      {
        key: 'height',
        label: 'Height',
        type: 'i64',
      },
      {
        key: 'format',
        label: 'Format',
        type: 'string',
      },
      {
        key: 'info',
        label: 'All of it',
        type: 'json',
      },
    ],
    config: [],
    capabilities: [
      {
        kind: 'fs.read',
        scope: 'input-handles',
        reason: 'Reads the image you connect to this node, and nothing else.',
      },
    ],
    platforms: ['windows', 'macos', 'linux'],
    sourceFile: 'crates/encastra-builtins/src/media.rs',
  },
  {
    id: 'encastra.image.resize',
    version: '1.0.0',
    name: 'Resize Image',
    description: "Changes an image's size. Leave one side empty to keep the proportions.",
    category: 'media',
    isTrigger: false,
    inputs: [
      {
        key: 'image',
        label: 'Image',
        type: 'image',
        required: true,
      },
    ],
    outputs: [
      {
        key: 'image',
        label: 'Resized',
        type: 'image',
      },
      {
        key: 'width',
        label: 'Width',
        type: 'i64',
      },
      {
        key: 'height',
        label: 'Height',
        type: 'i64',
      },
    ],
    config: [
      {
        key: 'width',
        label: 'Width',
        type: 'i64',
        required: false,
        doc: 'Leave at 0 to work it out from the height.',
      },
      {
        key: 'height',
        label: 'Height',
        type: 'i64',
        required: false,
        doc: 'Leave at 0 to work it out from the width.',
      },
      {
        key: 'mode',
        label: 'Fit',
        type: 'string',
        required: false,
        doc: 'Contain fits inside the box. Cover fills it and crops. Stretch distorts.',
      },
      {
        key: 'quality',
        label: 'JPEG quality',
        type: 'i64',
        required: false,
        doc: null,
      },
    ],
    capabilities: [
      {
        kind: 'fs.read',
        scope: 'input-handles',
        reason: 'Reads the image you connect to this node, and nothing else.',
      },
    ],
    platforms: ['windows', 'macos', 'linux'],
    sourceFile: 'crates/encastra-builtins/src/media.rs',
  },
  {
    id: 'encastra.image.thumbnail',
    version: '1.0.0',
    name: 'Thumbnail',
    description: 'Makes a small square preview of an image.',
    category: 'media',
    isTrigger: false,
    inputs: [
      {
        key: 'image',
        label: 'Image',
        type: 'image',
        required: true,
      },
    ],
    outputs: [
      {
        key: 'image',
        label: 'Thumbnail',
        type: 'image',
      },
    ],
    config: [
      {
        key: 'size',
        label: 'Size',
        type: 'i64',
        required: false,
        doc: 'The width and height of the square, in pixels.',
      },
      {
        key: 'quality',
        label: 'JPEG quality',
        type: 'i64',
        required: false,
        doc: null,
      },
    ],
    capabilities: [
      {
        kind: 'fs.read',
        scope: 'input-handles',
        reason: 'Reads the image you connect to this node, and nothing else.',
      },
    ],
    platforms: ['windows', 'macos', 'linux'],
    sourceFile: 'crates/encastra-builtins/src/media.rs',
  },
  {
    id: 'encastra.net.http',
    version: '1.0.0',
    name: 'HTTP Request',
    description: 'Fetches a web address, or sends data to one.',
    category: 'network',
    isTrigger: false,
    inputs: [
      {
        key: 'body',
        label: 'Body',
        type: 'string',
        required: false,
      },
    ],
    outputs: [
      {
        key: 'body',
        label: 'Response',
        type: 'string',
      },
      {
        key: 'status',
        label: 'Status code',
        type: 'i64',
      },
      {
        key: 'ok',
        label: 'Succeeded',
        type: 'bool',
      },
    ],
    config: [
      {
        key: 'url',
        label: 'Address',
        type: 'string',
        required: true,
        doc: 'Must be https unless you allow plain http below.',
      },
      {
        key: 'method',
        label: 'Method',
        type: 'string',
        required: false,
        doc: null,
      },
      {
        key: 'content_type',
        label: 'Content type',
        type: 'string',
        required: false,
        doc: 'For example application/json.',
      },
      {
        key: 'allow_http',
        label: 'Allow plain http',
        type: 'bool',
        required: false,
        doc: 'Off by default. Plain http can be read and changed in transit.',
      },
    ],
    capabilities: [
      {
        kind: 'net.http',
        scope: 'allowed-hosts',
        reason: 'Contacts the specific web addresses you allow, and no others.',
      },
    ],
    platforms: ['windows', 'macos', 'linux'],
    sourceFile: 'crates/encastra-builtins/src/net.rs',
  },
  {
    id: 'encastra.system.clipboard',
    version: '1.0.0',
    name: 'Copy to Clipboard',
    description: 'Puts text on the clipboard, ready to paste.',
    category: 'system',
    isTrigger: false,
    inputs: [
      {
        key: 'text',
        label: 'text',
        type: 'string',
        required: true,
      },
    ],
    outputs: [
      {
        key: 'text',
        label: 'What was copied',
        type: 'string',
      },
    ],
    config: [],
    capabilities: [
      {
        kind: 'system.clipboard',
        scope: 'write',
        reason: 'Replaces whatever is currently on your clipboard with this text.',
      },
    ],
    platforms: ['windows', 'macos', 'linux'],
    sourceFile: 'crates/encastra-builtins/src/system.rs',
  },
  {
    id: 'encastra.system.notify',
    version: '1.0.0',
    name: 'Notify',
    description: 'Shows a message when this step runs.',
    category: 'system',
    isTrigger: false,
    inputs: [
      {
        key: 'message',
        label: 'message',
        type: 'string',
        required: true,
      },
    ],
    outputs: [
      {
        key: 'message',
        label: 'What was shown',
        type: 'string',
      },
    ],
    config: [
      {
        key: 'title',
        label: 'Title',
        type: 'string',
        required: false,
        doc: null,
      },
    ],
    capabilities: [
      {
        kind: 'system.notify',
        scope: 'notifications',
        reason: 'Shows a notification on your desktop when this step runs.',
      },
    ],
    platforms: ['windows', 'macos', 'linux'],
    sourceFile: 'crates/encastra-builtins/src/system.rs',
  },
  {
    id: 'encastra.system.timer',
    version: '1.0.0',
    name: 'Timer',
    description: 'Starts the workflow again and again, on a schedule.',
    category: 'system',
    isTrigger: true,
    inputs: [],
    outputs: [
      {
        key: 'count',
        label: 'How many times so far',
        type: 'i64',
      },
    ],
    config: [
      {
        key: 'seconds',
        label: 'Every',
        type: 'i64',
        required: true,
        doc: 'In seconds. The first run happens straight away.',
      },
    ],
    capabilities: [],
    platforms: ['windows', 'macos', 'linux'],
    sourceFile: 'crates/encastra-builtins/src/triggers.rs',
  },
] as const;
