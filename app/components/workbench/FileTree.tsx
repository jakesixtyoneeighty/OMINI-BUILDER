import { memo, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { FileMap } from '~/lib/stores/files';
import { classNames } from '~/utils/classNames';
import { createScopedLogger, renderLogger } from '~/utils/logger';

const logger = createScopedLogger('FileTree');

const NODE_PADDING_LEFT = 12;
const DEFAULT_HIDDEN_FILES = [/\/node_modules\//, /\/\.next/, /\/\.astro/];

interface Props {
  files?: FileMap;
  selectedFile?: string;
  onFileSelect?: (filePath: string) => void;
  rootFolder?: string;
  hideRoot?: boolean;
  collapsed?: boolean;
  allowFolderSelection?: boolean;
  hiddenFiles?: Array<string | RegExp>;
  unsavedFiles?: Set<string>;
  className?: string;
}

export const FileTree = memo(
  ({
    files = {},
    onFileSelect,
    selectedFile,
    rootFolder,
    hideRoot = false,
    collapsed = false,
    allowFolderSelection = false,
    hiddenFiles,
    className,
    unsavedFiles,
  }: Props) => {
    renderLogger.trace('FileTree');

    const computedHiddenFiles = useMemo(() => [...DEFAULT_HIDDEN_FILES, ...(hiddenFiles ?? [])], [hiddenFiles]);

    const fileList = useMemo(() => {
      return buildFileList(files, rootFolder, hideRoot, computedHiddenFiles);
    }, [files, rootFolder, hideRoot, computedHiddenFiles]);

    const [collapsedFolders, setCollapsedFolders] = useState(() => {
      return collapsed
        ? new Set(fileList.filter((item) => item.kind === 'folder').map((item) => item.fullPath))
        : new Set<string>();
    });

    useEffect(() => {
      if (collapsed) {
        setCollapsedFolders(new Set(fileList.filter((item) => item.kind === 'folder').map((item) => item.fullPath)));
        return;
      }

      setCollapsedFolders((prevCollapsed) => {
        const newCollapsed = new Set<string>();

        for (const folder of fileList) {
          if (folder.kind === 'folder' && prevCollapsed.has(folder.fullPath)) {
            newCollapsed.add(folder.fullPath);
          }
        }

        return newCollapsed;
      });
    }, [fileList, collapsed]);

    const filteredFileList = useMemo(() => {
      const list = [];

      let lastDepth = Number.MAX_SAFE_INTEGER;

      for (const fileOrFolder of fileList) {
        const depth = fileOrFolder.depth;

        // if the depth is equal we reached the end of the collaped group
        if (lastDepth === depth) {
          lastDepth = Number.MAX_SAFE_INTEGER;
        }

        // ignore collapsed folders
        if (collapsedFolders.has(fileOrFolder.fullPath)) {
          lastDepth = Math.min(lastDepth, depth);
        }

        // ignore files and folders below the last collapsed folder
        if (lastDepth < depth) {
          continue;
        }

        list.push(fileOrFolder);
      }

      return list;
    }, [fileList, collapsedFolders]);

    const toggleCollapseState = (fullPath: string) => {
      setCollapsedFolders((prevSet) => {
        const newSet = new Set(prevSet);

        if (newSet.has(fullPath)) {
          newSet.delete(fullPath);
        } else {
          newSet.add(fullPath);
        }

        return newSet;
      });
    };

    return (
      <div className={classNames('text-sm', className)}>
        {filteredFileList.map((fileOrFolder) => {
          switch (fileOrFolder.kind) {
            case 'file': {
              return (
                <File
                  key={fileOrFolder.id}
                  selected={selectedFile === fileOrFolder.fullPath}
                  file={fileOrFolder}
                  unsavedChanges={unsavedFiles?.has(fileOrFolder.fullPath)}
                  onClick={() => {
                    onFileSelect?.(fileOrFolder.fullPath);
                  }}
                />
              );
            }
            case 'folder': {
              return (
                <Folder
                  key={fileOrFolder.id}
                  folder={fileOrFolder}
                  selected={allowFolderSelection && selectedFile === fileOrFolder.fullPath}
                  collapsed={collapsedFolders.has(fileOrFolder.fullPath)}
                  onClick={() => {
                    toggleCollapseState(fileOrFolder.fullPath);
                  }}
                />
              );
            }
            default: {
              return undefined;
            }
          }
        })}
      </div>
    );
  },
);

export default FileTree;

interface FolderProps {
  folder: FolderNode;
  collapsed: boolean;
  selected?: boolean;
  onClick: () => void;
}

function Folder({ folder: { depth, name }, collapsed, selected = false, onClick }: FolderProps) {
  return (
    <NodeButton
      className={classNames(
        'group transition-all duration-150 ease-out rounded-lg',
        {
          'text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive/50':
            !selected,
          'bg-bolt-elements-item-backgroundAccent/15 text-bolt-elements-item-contentAccent border-l-2 border-bolt-elements-item-contentAccent': selected,
        },
      )}
      depth={depth}
      iconClasses={classNames(
        'transition-all duration-200 text-base shrink-0',
        {
          'i-ph:folder text-blue-400/60': collapsed,
          'i-ph:folder-open text-blue-400': !collapsed,
        },
      )}
      onClick={onClick}
    >
      <span className="font-medium text-sm truncate">{name}</span>
    </NodeButton>
  );
}

interface FileProps {
  file: FileNode;
  selected: boolean;
  unsavedChanges?: boolean;
  onClick: () => void;
}

function File({ file: { depth, name }, onClick, selected, unsavedChanges = false }: FileProps) {
  const fileIcon = getFileIcon(name);
  
  return (
    <NodeButton
      className={classNames(
        'group transition-all duration-150 ease-out rounded-lg flex items-center gap-2',
        {
          'text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive/50':
            !selected,
          'bg-bolt-elements-item-backgroundAccent/15 text-bolt-elements-item-contentAccent border-l-2 border-bolt-elements-item-contentAccent': selected,
        },
      )}
      depth={depth}
      iconClasses={classNames(
        'shrink-0 text-sm transition-all duration-200',
        fileIcon.color,
      )}
      icon={fileIcon.icon}
      onClick={onClick}
    >
      <div className="flex items-center flex-1 min-w-0 gap-1.5">
        <div className="flex-1 truncate text-xs font-medium">{name}</div>
        {unsavedChanges && (
          <span className="i-ph:circle-fill scale-50 shrink-0 text-amber-400 flex-shrink-0" />
        )}
      </div>
    </NodeButton>
  );
}

interface ButtonProps {
  depth: number;
  iconClasses: string;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  icon?: string;
}

function NodeButton({ depth, iconClasses, onClick, className, children, icon }: ButtonProps) {
  return (
    <button
      className={classNames(
        'flex items-center gap-2.5 w-full px-2.5 py-2 text-left transition-colors duration-150',
        className,
      )}
      style={{ paddingLeft: `${10 + depth * NODE_PADDING_LEFT}px` }}
      onClick={() => onClick?.()}
    >
      <div className={classNames('shrink-0', icon || iconClasses)}></div>
      <div className="truncate w-full">{children}</div>
    </button>
  );
}

/**
 * Returns the appropriate icon and color for a file based on its extension
 */
function getFileIcon(fileName: string): { icon: string; color: string } {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  
  // Default icon for unknown files
  const defaultIcon = { icon: 'i-ph:file-duotone', color: 'text-bolt-elements-textTertiary' };
  
  const iconMap: Record<string, { icon: string; color: string }> = {
    // JavaScript/TypeScript
    js: { icon: 'i-ph:file-js-duotone', color: 'text-yellow-500' },
    ts: { icon: 'i-ph:file-ts-duotone', color: 'text-blue-500' },
    tsx: { icon: 'i-ph:file-ts-duotone', color: 'text-cyan-500' },
    jsx: { icon: 'i-ph:file-js-duotone', color: 'text-teal-500' },
    
    // CSS
    css: { icon: 'i-ph:file-css-duotone', color: 'text-blue-500' },
    scss: { icon: 'i-ph:file-css-duotone', color: 'text-pink-500' },
    sass: { icon: 'i-ph:file-css-duotone', color: 'text-pink-500' },
    less: { icon: 'i-ph:file-css-duotone', color: 'text-blue-400' },
    
    // HTML
    html: { icon: 'i-ph:file-html-duotone', color: 'text-orange-500' },
    
    // JSON
    json: { icon: 'i-ph:file-json-duotone', color: 'text-green-500' },
    
    // Markdown
    md: { icon: 'i-ph:file-text-duotone', color: 'text-gray-500' },
    mdx: { icon: 'i-ph:file-text-duotone', color: 'text-gray-500' },
    
    // Python
    py: { icon: 'i-ph:file-python-duotone', color: 'text-yellow-500' },
    
    // Rust
    rs: { icon: 'i-ph:file-code-duotone', color: 'text-orange-500' },
    
    // Go
    go: { icon: 'i-ph:file-code-duotone', color: 'text-cyan-500' },
    
    // Ruby
    rb: { icon: 'i-ph:file-code-duotone', color: 'text-red-500' },
    
    // PHP
    php: { icon: 'i-ph:file-php-duotone', color: 'text-purple-500' },
    
    // Shell
    sh: { icon: 'i-ph:terminal-window-duotone', color: 'text-green-500 dark:text-green-400' },
    bash: { icon: 'i-ph:terminal-window-duotone', color: 'text-green-400 dark:text-green-300' },
    zsh: { icon: 'i-ph:terminal-window-duotone', color: 'text-green-300 dark:text-green-200' },
    
    // Config files
    env: { icon: 'i-ph:gear-duotone', color: 'text-yellow-600 dark:text-yellow-500' },
    config: { icon: 'i-ph:gear-duotone', color: 'text-gray-500 dark:text-gray-400' },
    yaml: { icon: 'i-ph:file-dotted-duotone', color: 'text-blue-300 dark:text-blue-200' },
    yml: { icon: 'i-ph:file-dotted-duotone', color: 'text-blue-300 dark:text-blue-200' },
    toml: { icon: 'i-ph:file-dotted-duotone', color: 'text-orange-300 dark:text-orange-200' },
    
    // Images
    png: { icon: 'i-ph:image-duotone', color: 'text-purple-400 dark:text-purple-300' },
    jpg: { icon: 'i-ph:image-duotone', color: 'text-purple-300 dark:text-purple-200' },
    jpeg: { icon: 'i-ph:image-duotone', color: 'text-purple-300 dark:text-purple-200' },
    svg: { icon: 'i-ph:image-duotone', color: 'text-pink-400 dark:text-pink-300' },
    gif: { icon: 'i-ph:image-duotone', color: 'text-pink-300 dark:text-pink-200' },
    webp: { icon: 'i-ph:image-duotone', color: 'text-blue-400 dark:text-blue-300' },
    
    // Default
  };
  
  return iconMap[ext] || { icon: 'i-ph:file-duotone', color: 'text-gray-400 dark:text-gray-300' };
}

type Node = FileNode | FolderNode;

interface BaseNode {
  id: number;
  depth: number;
  name: string;
  fullPath: string;
}

interface FileNode extends BaseNode {
  kind: 'file';
}

interface FolderNode extends BaseNode {
  kind: 'folder';
}

function buildFileList(
  files: FileMap,
  rootFolder = '/',
  hideRoot: boolean,
  hiddenFiles: Array<string | RegExp>,
): Node[] {
  const folderPaths = new Set<string>();
  const fileList: Node[] = [];

  let defaultDepth = 0;

  if (rootFolder === '/' && !hideRoot) {
    defaultDepth = 1;
    fileList.push({ kind: 'folder', name: '/', depth: 0, id: 0, fullPath: '/' });
  }

  for (const [filePath, dirent] of Object.entries(files)) {
    const segments = filePath.split('/').filter((segment) => segment);
    const fileName = segments.at(-1);

    if (!fileName || isHiddenFile(filePath, fileName, hiddenFiles)) {
      continue;
    }

    let currentPath = '';

    let i = 0;
    let depth = 0;

    while (i < segments.length) {
      const name = segments[i];
      const fullPath = (currentPath += `/${name}`);

      if (!fullPath.startsWith(rootFolder) || (hideRoot && fullPath === rootFolder)) {
        i++;
        continue;
      }

      if (i === segments.length - 1 && dirent?.type === 'file') {
        fileList.push({
          kind: 'file',
          id: fileList.length,
          name,
          fullPath,
          depth: depth + defaultDepth,
        });
      } else if (!folderPaths.has(fullPath)) {
        folderPaths.add(fullPath);

        fileList.push({
          kind: 'folder',
          id: fileList.length,
          name,
          fullPath,
          depth: depth + defaultDepth,
        });
      }

      i++;
      depth++;
    }
  }

  return sortFileList(rootFolder, fileList, hideRoot);
}

function isHiddenFile(filePath: string, fileName: string, hiddenFiles: Array<string | RegExp>) {
  return hiddenFiles.some((pathOrRegex) => {
    if (typeof pathOrRegex === 'string') {
      return fileName === pathOrRegex;
    }

    return pathOrRegex.test(filePath);
  });
}

/**
 * Sorts the given list of nodes into a tree structure (still a flat list).
 *
 * This function organizes the nodes into a hierarchical structure based on their paths,
 * with folders appearing before files and all items sorted alphabetically within their level.
 *
 * @note This function mutates the given `nodeList` array for performance reasons.
 *
 * @param rootFolder - The path of the root folder to start the sorting from.
 * @param nodeList - The list of nodes to be sorted.
 *
 * @returns A new array of nodes sorted in depth-first order.
 */
function sortFileList(rootFolder: string, nodeList: Node[], hideRoot: boolean): Node[] {
  logger.trace('sortFileList');

  const nodeMap = new Map<string, Node>();
  const childrenMap = new Map<string, Node[]>();

  // pre-sort nodes by name and type
  nodeList.sort((a, b) => compareNodes(a, b));

  for (const node of nodeList) {
    nodeMap.set(node.fullPath, node);

    const parentPath = node.fullPath.slice(0, node.fullPath.lastIndexOf('/'));

    if (parentPath !== rootFolder.slice(0, rootFolder.lastIndexOf('/'))) {
      if (!childrenMap.has(parentPath)) {
        childrenMap.set(parentPath, []);
      }

      childrenMap.get(parentPath)?.push(node);
    }
  }

  const sortedList: Node[] = [];

  const depthFirstTraversal = (path: string): void => {
    const node = nodeMap.get(path);

    if (node) {
      sortedList.push(node);
    }

    const children = childrenMap.get(path);

    if (children) {
      for (const child of children) {
        if (child.kind === 'folder') {
          depthFirstTraversal(child.fullPath);
        } else {
          sortedList.push(child);
        }
      }
    }
  };

  if (hideRoot) {
    // if root is hidden, start traversal from its immediate children
    const rootChildren = childrenMap.get(rootFolder) || [];

    for (const child of rootChildren) {
      depthFirstTraversal(child.fullPath);
    }
  } else {
    depthFirstTraversal(rootFolder);
  }

  return sortedList;
}

function compareNodes(a: Node, b: Node): number {
  if (a.kind !== b.kind) {
    return a.kind === 'folder' ? -1 : 1;
  }

  return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
}
