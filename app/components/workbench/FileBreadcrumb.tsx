import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { AnimatePresence, motion, type Variants } from 'framer-motion';
import { memo, useEffect, useRef, useState } from 'react';
import type { FileMap } from '~/lib/stores/files';
import { classNames } from '~/utils/classNames';
import { WORK_DIR } from '~/utils/constants';
import { cubicEasingFn } from '~/utils/easings';
import { renderLogger } from '~/utils/logger';
import FileTree from './FileTree';

const WORK_DIR_REGEX = new RegExp(`^${WORK_DIR.split('/').slice(0, -1).join('/').replaceAll('/', '\\/')}/`);

interface FileBreadcrumbProps {
  files?: FileMap;
  pathSegments?: string[];
  onFileSelect?: (filePath: string) => void;
}

const contextMenuVariants = {
  open: {
    y: 0,
    opacity: 1,
    transition: {
      duration: 0.15,
      ease: cubicEasingFn,
    },
  },
  close: {
    y: 6,
    opacity: 0,
    transition: {
      duration: 0.15,
      ease: cubicEasingFn,
    },
  },
} satisfies Variants;

export const FileBreadcrumb = memo<FileBreadcrumbProps>(({ files, pathSegments = [], onFileSelect }) => {
  renderLogger.trace('FileBreadcrumb');

  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  const segmentRefs = useRef<(HTMLSpanElement | null)[]>([]);

  const handleSegmentClick = (index: number) => {
    setActiveIndex((prevIndex) => (prevIndex === index ? null : index));
  };

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        activeIndex !== null &&
        !contextMenuRef.current?.contains(event.target as Node) &&
        !segmentRefs.current.some((ref) => ref?.contains(event.target as Node))
      ) {
        setActiveIndex(null);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [activeIndex]);

  if (files === undefined || pathSegments.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-1">
      {pathSegments.map((segment, index) => {
        const isLast = index === pathSegments.length - 1;

        const path = pathSegments.slice(0, index).join('/');

        if (!WORK_DIR_REGEX.test(path)) {
          return null;
        }

        const isActive = activeIndex === index;

        return (
          <div key={index} className="relative flex items-center gap-1.5">
            {index > 0 && <div className="i-ph:caret-right text-[10px] text-bolt-elements-textTertiary/30" />}
            <DropdownMenu.Root open={isActive} modal={false}>
              <DropdownMenu.Trigger asChild>
                <button
                  ref={(ref) => (segmentRefs.current[index] = ref)}
                  className={classNames(
                    'flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium transition-all duration-150 cursor-pointer shrink-0',
                    {
                      'text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive/30': !isActive,
                      'text-bolt-elements-item-contentAccent bg-bolt-elements-item-backgroundAccent/10': isActive,
                    },
                  )}
                  onClick={() => handleSegmentClick(index)}
                >
                  <span className="truncate max-w-[120px]">{segment}</span>
                </button>
              </DropdownMenu.Trigger>
              <AnimatePresence>
                {isActive && (
                  <DropdownMenu.Portal>
                    <DropdownMenu.Content
                      className="z-file-tree-breadcrumb"
                      asChild
                      align="start"
                      side="bottom"
                      avoidCollisions={false}
                    >
                      <motion.div
                        ref={contextMenuRef}
                        initial="close"
                        animate="open"
                        exit="close"
                        variants={contextMenuVariants}
                      >
                        <div className="modern-dropdown">
                          <div className="max-h-[60vh] min-w-[260px] overflow-y-auto">
                            <FileTree
                              files={files}
                              hideRoot
                              rootFolder={path}
                              collapsed
                              allowFolderSelection
                              selectedFile={`${path}/${segment}`}
                              onFileSelect={(filePath) => {
                                setActiveIndex(null);
                                onFileSelect?.(filePath);
                              }}
                            />
                          </div>
                        </div>
                        <DropdownMenu.Arrow className="fill-bolt-elements-borderColor" />
                      </motion.div>
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                )}
              </AnimatePresence>
            </DropdownMenu.Root>
          </div>
        );
      })}
    </div>
  );
});
