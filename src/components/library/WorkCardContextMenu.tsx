import { useEffect } from 'react';
import { FolderOpen, RefreshCw } from 'lucide-react';

interface WorkCardContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onOpenFolder: () => void;
  onRescan: () => void;
}

export function WorkCardContextMenu({
  x,
  y,
  onClose,
  onOpenFolder,
  onRescan,
}: WorkCardContextMenuProps) {
  useEffect(() => {
    function handleClick() {
      onClose();
    }
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [onClose]);

  return (
    <div
      className="fixed z-50 min-w-[180px] py-1 bg-dark-card border border-dark-border rounded-lg shadow-xl"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={() => {
          onOpenFolder();
          onClose();
        }}
        className="w-full px-4 py-2 text-left text-sm hover:bg-dark-hover flex items-center gap-2"
      >
        <FolderOpen size={16} />
        フォルダを開く
      </button>
      <button
        onClick={() => {
          onRescan();
          onClose();
        }}
        className="w-full px-4 py-2 text-left text-sm hover:bg-dark-hover flex items-center gap-2"
      >
        <RefreshCw size={16} />
        最新の状態に更新
      </button>
    </div>
  );
}
