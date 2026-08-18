import { useState } from 'react';
import * as XLSX from 'xlsx';
import { useAdmin } from '../context/AdminContext';

const MAX_ROWS = 5000;
const TODAY = () => new Date().toISOString().slice(0, 10);

export interface ExcelSheet {
  name: string;
  data: Record<string, unknown>[];
}

export interface DownloadOptions {
  filename: string;
  menu: string;
  filters: string;
  sheets: ExcelSheet[];
}

interface ToastState {
  message: string;
  type: 'success' | 'error';
}

export function useExcelDownload() {
  const { currentAdmin, canDownload, addDownloadLog } = useAdmin();
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = (message: string, type: ToastState['type']) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const download = async (options: DownloadOptions) => {
    if (!canDownload) {
      showToast('엑셀 다운로드 권한이 없습니다.', 'error');
      return;
    }

    const totalCount = options.sheets.reduce((sum, s) => sum + s.data.length, 0);
    if (totalCount === 0) {
      showToast('다운로드할 데이터가 없습니다.', 'error');
      return;
    }

    setIsLoading(true);
    try {
      // Simulate async server processing delay (300ms)
      await new Promise(res => setTimeout(res, 300));

      const wb = XLSX.utils.book_new();

      let totalDownloaded = 0;
      for (const sheet of options.sheets) {
        const limited = sheet.data.slice(0, MAX_ROWS);
        totalDownloaded += limited.length;
        const ws = XLSX.utils.json_to_sheet(limited);
        // Auto column widths
        const cols = Object.keys(limited[0] ?? {}).map(k => ({ wch: Math.max(k.length + 2, 12) }));
        ws['!cols'] = cols;
        XLSX.utils.book_append_sheet(wb, ws, sheet.name);
      }

      const filename = `foodpicker_${options.filename}_${TODAY()}.xlsx`;
      XLSX.writeFile(wb, filename);

      const logged = await addDownloadLog({
        adminId: currentAdmin.id,
        adminName: currentAdmin.name,
        menu: options.menu,
        filters: options.filters || '없음',
        downloadedAt: new Date().toLocaleString('ko-KR'),
        count: totalDownloaded,
      });

      const limitMsg = totalCount > MAX_ROWS ? ` (최대 ${MAX_ROWS.toLocaleString()}건 제한 적용)` : '';
      if (logged) {
        showToast(`엑셀 파일이 다운로드되었습니다. (${totalDownloaded.toLocaleString()}건)${limitMsg}`, 'success');
      } else {
        // 파일은 내려갔지만 감사 로그가 안 남았다 — 조용히 넘기면 '기록됐다'는 오해가 생긴다.
        showToast(
          `엑셀은 다운로드됐지만 다운로드 이력 기록에 실패했습니다. (${totalDownloaded.toLocaleString()}건)${limitMsg} 관리자에게 알려주세요.`,
          'error',
        );
      }
    } catch {
      showToast('엑셀 다운로드에 실패했습니다. 다시 시도해주세요.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return { download, isLoading, toast, canDownload };
}
