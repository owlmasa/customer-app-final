import React, { useRef } from 'react';
import Papa from 'papaparse';
import { Upload } from 'lucide-react';
import { Customer } from '../types';

interface Props {
  onImport: (customers: Omit<Customer, 'id'>[]) => void;
}

export const CSVImport: React.FC<Props> = ({ onImport }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const importedData: Omit<Customer, 'id'>[] = [];
        results.data.forEach((row: any) => {
            const customerNumber = row['得意先番号'];
            const name = row['顧客名'];
            const address = row['住所'] || '';
            const remarks = row['備考欄'] || '';
            if (customerNumber && name) {
                importedData.push({
                    customerNumber: String(customerNumber).trim(),
                    name: String(name).trim(),
                    address: String(address).trim(),
                    remarks: String(remarks).trim(),
                });
            }
        });
        if (importedData.length > 0) {
            onImport(importedData);
            alert(`${importedData.length}件のデータをインポートしました。`);
        } else {
            alert('有効なデータが見つかりませんでした。CSVのフォーマットを確認してください。');
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
      },
      error: (error) => { console.error(error); alert('CSVの読み込みに失敗しました。'); }
    });
  };

  return (
    <div>
      <input type="file" accept=".csv" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
      <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors shadow-sm text-sm font-medium">
        <Upload size={18} /> CSVインポート
      </button>
    </div>
  );
};
