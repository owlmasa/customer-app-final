import React, { useState } from 'react';
import { ClipboardCopy, Check } from 'lucide-react';
import { useStore } from '../store/useStore';
import { buildMigrationText } from '../migration';

// クラウド版へ移すためのデータを、曜日・並び順ごとクリップボードにコピー
export const MigrationExport: React.FC = () => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const { customers, schedules } = useStore.getState();
    const count = Object.keys(customers).length;
    if (count === 0) {
      alert('コピーするデータがありません。');
      return;
    }
    const text = buildMigrationText(customers, schedules);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
      alert(`${count}件のデータをコピーしました。クラウド版の「接続設定 → 移行データを貼り付け」に貼り付けてください。`);
    } catch {
      // クリップボードが使えない環境ではファイルで保存
      const blob = new Blob([text], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `移行用データ_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="flex items-center justify-center gap-1 md:gap-2 px-3 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors shadow-sm text-xs md:text-sm font-medium whitespace-nowrap border-0 cursor-pointer appearance-none"
      title="クラウド版への移行用にコピー"
    >
      {copied ? <Check size={16} className="md:w-[18px] md:h-[18px]" /> : <ClipboardCopy size={16} className="md:w-[18px] md:h-[18px]" />}
      <span>移行用コピー</span>
    </button>
  );
};
