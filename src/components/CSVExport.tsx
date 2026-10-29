import React, { useState } from 'react';
import { FileUp, Loader2, X } from 'lucide-react';
import clsx from 'clsx';
import { Customer, DayOfWeek, DAYS_OF_WEEK } from '../types';
import { useSync } from '../sync/useSync';
import { stashCsv } from '../sync/api';
import { LIFF_ID } from '../config';

interface Props {
  customers: Record<string, Customer>;
  schedules: Partial<Record<DayOfWeek, string[]>>;
  currentDay: DayOfWeek;
}

interface Row {
  customer: Customer;
  day: DayOfWeek;
}

const dayLabel = (d: DayOfWeek) => (d === 'その他' ? 'その他' : `${d}曜日`);

// 曜日の列は最後に付ける（取込は列名で読むので、そのまま取り込める）
const buildCsv = (rows: Row[]) => {
  const header = '得意先番号,顧客名,法人,メーカー,新商品,訪問頻度,ゴミ回収,ロケーション,住所,備考欄,曜日\n';
  const escape = (str: string) => `"${(str || '').replace(/"/g, '""')}"`;
  const content = rows
    .map(({ customer: c, day }) => `${escape(c.customerNumber)},${escape(c.name)},${c.isCorporate ? 'TRUE' : 'FALSE'},${escape(c.maker || '')},${escape((c.newProducts || []).join('/'))},${escape(c.visitFrequency || '')},${c.isTrashCollection ? 'TRUE' : 'FALSE'},${escape(c.locationType || '')},${escape(c.address)},${escape(c.remarks)},${escape(day)}`)
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

export const CSVExport: React.FC<Props> = ({ customers, schedules, currentDay }) => {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState<DayOfWeek[]>([currentDay]);

  const countOf = (d: DayOfWeek) => (schedules[d] || []).filter(id => customers[id]).length;
  const allSelected = DAYS_OF_WEEK.every(d => days.includes(d));
  const selectedRows: Row[] = DAYS_OF_WEEK.filter(d => days.includes(d)).flatMap(d =>
    (schedules[d] || []).map(id => customers[id]).filter(Boolean).map(customer => ({ customer, day: d })),
  );

  const openDialog = () => {
    setDays([currentDay]); // 開くたびに表示中の曜日だけ
    setOpen(true);
  };

  const toggleDay = (d: DayOfWeek) =>
    setDays(ds => (ds.includes(d) ? ds.filter(x => x !== d) : [...ds, d]));

  const handleExport = async () => {
    if (selectedRows.length === 0) return;
    const text = buildCsv(selectedRows);
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const daysPart = allSelected ? '全曜日' : DAYS_OF_WEEK.filter(d => days.includes(d)).join('');
    const filename = `顧客リスト_${daysPart}_${date}.csv`;
    setOpen(false);
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
    <>
    <button onClick={openDialog} disabled={busy} className="flex items-center justify-center gap-1 md:gap-2 px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors shadow-sm text-xs md:text-sm font-medium whitespace-nowrap border-0 cursor-pointer appearance-none disabled:opacity-60">
      {busy ? <Loader2 size={16} className="animate-spin" /> : <FileUp size={16} className="md:w-[18px] md:h-[18px]" />}
      <span className="hidden sm:inline">エクスポート</span>
      <span className="inline sm:hidden">出力</span>
    </button>
    {open && (
      <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center" onClick={() => setOpen(false)}>
        <div className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-xl p-5 space-y-4" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between">
            <p className="font-bold text-gray-900">出力する曜日を選ぶ</p>
            <button onClick={() => setOpen(false)} className="p-1 text-gray-400 bg-transparent"><X size={20} /></button>
          </div>
          <button
            onClick={() => setDays(allSelected ? [] : [...DAYS_OF_WEEK])}
            className={clsx('w-full py-2.5 rounded-md text-sm font-bold border', allSelected ? 'bg-[#0050A0] text-white border-[#0050A0]' : 'bg-white text-[#0050A0] border-[#0050A0]')}
          >
            {allSelected ? '全選択を解除' : '全選択（すべての曜日）'}
          </button>
          <div className="grid grid-cols-3 gap-2">
            {DAYS_OF_WEEK.map(d => {
              const on = days.includes(d);
              return (
                <button
                  key={d}
                  onClick={() => toggleDay(d)}
                  className={clsx('py-2.5 rounded-md text-sm font-bold ring-1', on ? 'bg-blue-50 text-blue-700 ring-blue-400' : 'bg-gray-50 text-gray-500 ring-gray-200')}
                >
                  {dayLabel(d)}
                  <span className="block text-[11px] font-normal">{countOf(d)}件</span>
                </button>
              );
            })}
          </div>
          <button
            onClick={handleExport}
            disabled={selectedRows.length === 0}
            className="w-full py-3 rounded-md bg-gray-700 text-white font-bold disabled:opacity-40"
          >
            {selectedRows.length}件を出力する
          </button>
        </div>
      </div>
    )}
    </>
  );
};
