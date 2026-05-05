import { memo, useState, useRef, useCallback } from 'react';
import { toast } from 'react-toastify';

interface FileUploadButtonProps {
  onFilesSelected: (files: File[]) => void;
}

export const FileUploadButton = memo(function FileUploadButton({ onFilesSelected }: FileUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;

      const maxSize = 10 * 1024 * 1024;
      const validFiles = files.filter((f) => {
        if (f.size > maxSize) {
          toast.warning(`"${f.name}" excede 10MB.`);
          return false;
        }
        return true;
      });

      if (validFiles.length > 0) {
        onFilesSelected(validFiles);
      }

      e.target.value = '';
    },
    [onFilesSelected],
  );

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        accept="image/*,.txt,.md,.html,.css,.js,.ts,.tsx,.jsx,.json,.xml,.pdf,.zip,.py,.java,.c,.cpp,.h,.rb,.go,.rs,.php,.sql,.sh,.yaml,.yml,.toml,.env,.gitignore,.svg"
        onChange={handleChange}
      />
      <button
        type="button"
        onClick={handleClick}
        title="Upload de arquivos"
        className="flex items-center justify-center w-7 h-7 rounded-full border border-bolt-elements-borderColor text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:border-bolt-elements-textPrimary/40 hover:bg-bolt-elements-item-backgroundActive transition-all active:scale-95"
      >
        <div className="i-ph:plus text-[13px]" />
      </button>
    </>
  );
});
