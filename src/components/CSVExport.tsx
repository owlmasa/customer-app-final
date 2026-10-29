import React, { useState } from 'react';
import { FileUp, Loader2 } from 'lucide-react';
import { Customer } from '../types';
import { useSync } from '../sync/useSync';
import { stashCsv } from '../sync/api';
import { LIFF_ID } from '../config';

interface Props {
  customers: Customer[];
}

const buildCsv = (customers: Customer[]) => {
  const header = '得意先番号,顧客名,法人,メーカー,新商品,訪問頻度,ゴミ回収,ロケーション,住所,備考欄\n';
  const escape = (str: string) => `"${(str || '').replace(/"/g, '""')}"`;
  const content = customers
    .map(c => `${escape(c.customerNumber)},${escape(c.name)},${c.isCorporate ? 'TRUE' : 'FALSE'},${escape(c.maker || '')},${escape((c.newProducts || []).join('/'))},${escape(c.visitFrequency || '')},${c.isTrashCollection ? 'TRUE' : 'FALSE'},${escape(c.locationType || '')},${escape(c.address)},${escape(c.remarks)}`)
    .join('\n');
  return header + content;
};

// LINEアプリ内のブラウザ（ダウンロードできない）か
const isLineBrowser = () => /\bLine\//i.test(navigator.userAgent);

const downloadByLink = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
};

export const CSVExport: React.FC<Props> = ({ customers }) => {
  const [busy, setBusy] = useState(false);

  const handleExport = async () => {
    const text = buildCsv(customers);
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const filename = `顧客リスト_${date}.csv`;
    const blob = new Blob([new Uint8Array([0xef, 0xbb, 0xbf]), text], { type: 'text/csv' });

    // 1) スマホの共有シート（「ファイルに保存」やメール・LINEで送れる）
    try {
      const file = new File([blob], filename, { type: 'text/csv' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: filename });
        return;
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return; // 自分でキャンセル
      // 共有に失敗したら次の方法へ
    }

    // 2) LINEの中：サーバーに一時保存して、Safari/Chromeで開いてダウンロード
    if (isLineBrowser()) {
      const { gasUrl, apiKey } = useSync.getState();
      if (!gasUrl || !apiKey) {
        alert('LINEの中では出力できません。右上のメニューから「ブラウザで開く」を選んでから出力してください。');
        return;
      }
      setBusy(true);
      try {
        const token = await stashCsv(gasUrl, apiKey, text, filename);
        const url = `${gasUrl}?csv=${token}`;
        let opened = false;
        if (LIFF_ID) {
          try {
            const liff = (await import('@line/liff')).default;
            if (liff.isInClient()) {
              liff.openWindow({ url, external: true });
              opened = true;
            }
          } catch {
            // LIFFが使えなければ下へ
          }
        }
        if (!opened) window.location.href = url;
      } catch (e) {
        alert(`出力できませんでした：${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setBusy(false);
      }
      return;
    }

    // 3) ふつうのブラウザ：そのままダウンロード
    downloadByLink(blob, filename);
  };

  return (
    <button onClick={handleExport} disabled={busy} className="flex items-center justify-center gap-1 md:gap-2 px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors shadow-sm text-xs md:text-sm font-medium whitespace-nowrap border-0 cursor-pointer appearance-none disabled:opacity-60">
      {busy ? <Loader2 size={16} className="animate-spin" /> : <FileUp size={16} className="md:w-[18px] md:h-[18px]" />}
      <span className="hidden sm:inline">エクスポート</span>
      <span className="inline sm:hidden">出力</span>
    </button>
  );
};
