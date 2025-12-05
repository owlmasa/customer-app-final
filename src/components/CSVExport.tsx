import React from 'react';
import { Download } from 'lucide-react';
import { Customer } from '../types';

interface Props {
  customers: Customer[];
}

export const CSVExport: React.FC<Props> = ({ customers }) => {
  const handleExport = () => {
    // BOMを付与してExcelでの文字化けを防ぐ
    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
    const header = "得意先番号,顧客名,住所,備考欄\n";
    
    const content = customers.map(c => {
        // CSVのエスケープ処理（ダブルクォーテーションを2つ重ねる）
        const escape = (str: string) => `"${(str || '').replace(/"/g, '""')}"`;
        return `${escape(c.customerNumber)},${escape(c.name)},${escape(c.address)},${escape(c.remarks)}`;
    }).join("\n");

    const blob = new Blob([bom, header + content], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    a.download = `顧客リスト_${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors shadow-sm text-sm font-medium">
      <Download size={18} /> エクスポート
    </button>
  );
};

