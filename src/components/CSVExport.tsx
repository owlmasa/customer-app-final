import React from 'react';
import { FileUp } from 'lucide-react';
import { Customer } from '../types';

interface Props {
  customers: Customer[];
}

export const CSVExport: React.FC<Props> = ({ customers }) => {
  const handleExport = () => {
    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
    const header = "得意先番号,顧客名,法人,価格改定日,訪問頻度,ゴミ回収,ロケーション,住所,備考欄\n";
    
    const content = customers.map(c => {
        const escape = (str: string) => `"${(str || '').replace(/"/g, '""')}"`;
        return `${escape(c.customerNumber)},${escape(c.name)},${c.isCorporate ? 'TRUE' : 'FALSE'},${escape(c.priceRevisionDate || '')},${escape(c.visitFrequency || '')},${c.isTrashCollection ? 'TRUE' : 'FALSE'},${escape(c.locationType || '')},${escape(c.address)},${escape(c.remarks)}`;
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
    <button onClick={handleExport} className="flex items-center justify-center gap-1 md:gap-2 px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors shadow-sm text-xs md:text-sm font-medium whitespace-nowrap border-0 cursor-pointer appearance-none">
      <FileUp size={16} className="md:w-[18px] md:h-[18px]" />
      <span className="hidden sm:inline">エクスポート</span>
      <span className="inline sm:hidden">出力</span>
    </button>
  );
};
