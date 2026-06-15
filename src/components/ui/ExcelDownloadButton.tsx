import { Download, Loader2 } from 'lucide-react';

interface ExcelDownloadButtonProps {
  onClick: () => void;
  isLoading: boolean;
  hidden?: boolean;
}

export default function ExcelDownloadButton({ onClick, isLoading, hidden }: ExcelDownloadButtonProps) {
  if (hidden) return null;

  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      className="btn-secondary flex items-center gap-2 whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {isLoading ? (
        <>
          <Loader2 size={15} className="animate-spin" />
          <span>다운로드 중...</span>
        </>
      ) : (
        <>
          <Download size={15} className="text-primary" />
          <span>엑셀 다운로드</span>
        </>
      )}
    </button>
  );
}
