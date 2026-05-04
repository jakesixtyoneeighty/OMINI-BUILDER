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

      const maxSize = 10 * 1024 * 1024; // 10MB
      const validTypes = [
        'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml',
        'text/plain', 'text/html', 'text/css', 'text/javascript',
        'application/javascript', 'application/json', 'application/xml',
        'application/pdf', 'application/zip',
        'text/markdown', 'text/x-markdown',
      ];

      const validFiles = files.filter((f) => {
        if (f.size > maxSize) {
          toast.warning(`Arquivo "${f.name}" excede 10MB e sera ignorado.`);
          return false;
        }
        return true;
      });

      if (validFiles.length > 0) {
        onFilesSelected(validFiles);
        toast.info(`${validFiles.length} arquivo${validFiles.length > 1 ? 's' : ''} carregado${validFiles.length > 1 ? 's' : ''}: ${validFiles.map((f) => f.name).join(', ')}`, { autoClose: 3000 });
      }

      // Reset input
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
        className="flex items-center justify-center w-8 h-8 rounded-lg text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive transition-all active:scale-95"
      >
        <div className="i-ph:plus text-lg" />
      </button>
    </>
  );
});
