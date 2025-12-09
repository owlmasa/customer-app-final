import React, { useState, useEffect } from 'react';
import { Customer } from '../types';
import { X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<Customer, 'id'>) => void;
  initialData?: Customer;
  existingNumbers: string[];
}

const VISIT_FREQUENCIES = ['1', '2', '3', '4', '5', 'A', 'B'] as const;

export const CustomerForm: React.FC<Props> = ({ isOpen, onClose, onSubmit, initialData, existingNumbers }) => {
  const [formData, setFormData] = useState<Omit<Customer, 'id'>>({ 
    customerNumber: '', 
    name: '', 
    address: '', 
    remarks: '',
    isCorporate: false,
    isTrashCollection: false,
    priceRevisionDate: '',
    locationType: undefined,
    visitFrequency: undefined
  });
  const [errors, setErrors] = useState<Partial<Record<keyof Customer, string>>>({});

  useEffect(() => {
    if (initialData) {
      setFormData({ 
        customerNumber: initialData.customerNumber, 
        name: initialData.name, 
        address: initialData.address, 
        remarks: initialData.remarks,
        isCorporate: initialData.isCorporate || false,
        isTrashCollection: initialData.isTrashCollection || initialData.visitFrequency === 'ゴミ',
        priceRevisionDate: initialData.priceRevisionDate || '',
        locationType: initialData.locationType,
        visitFrequency: initialData.visitFrequency === 'ゴミ' ? undefined : initialData.visitFrequency
      });
    } else {
      setFormData({ 
        customerNumber: '', 
        name: '', 
        address: '', 
        remarks: '',
        isCorporate: false,
        isTrashCollection: false,
        priceRevisionDate: '',
        locationType: undefined,
        visitFrequency: undefined
      });
    }
    setErrors({});
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const validate = () => {
    const newErrors: any = {};
    if (!formData.customerNumber.trim()) newErrors.customerNumber = '必須項目です';
    if (!formData.name.trim()) newErrors.name = '必須項目です';
    const isNumberChanged = !initialData || initialData.customerNumber !== formData.customerNumber;
    if (isNumberChanged && existingNumbers.includes(formData.customerNumber)) {
      newErrors.customerNumber = '既に登録されています';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) { onSubmit(formData); onClose(); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md animate-fade-in max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-4 border-b sticky top-0 bg-white z-10">
          <h2 className="text-lg font-bold text-gray-800">{initialData ? '顧客情報編集' : '新規顧客追加'}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700"><X size={24} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">得意先番号 *</label>
            <input type="text" className={`w-full h-10 leading-normal px-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none appearance-none ${errors.customerNumber ? 'border-red-500' : 'border-gray-300'}`} value={formData.customerNumber} onChange={(e) => setFormData({ ...formData, customerNumber: e.target.value })} />
            {errors.customerNumber && <p className="text-red-500 text-xs mt-1">{errors.customerNumber}</p>}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">顧客名 *</label>
            <input type="text" className={`w-full h-10 leading-normal px-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none appearance-none ${errors.name ? 'border-red-500' : 'border-gray-300'}`} value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <input 
                type="checkbox" 
                id="isCorporate"
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                checked={formData.isCorporate}
                onChange={(e) => setFormData({ ...formData, isCorporate: e.target.checked })}
              />
              <label htmlFor="isCorporate" className="text-sm font-medium text-gray-700">法人</label>
            </div>
            <div className="flex items-center gap-2">
              <input 
                type="checkbox" 
                id="isTrashCollection"
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                checked={formData.isTrashCollection}
                onChange={(e) => setFormData({ ...formData, isTrashCollection: e.target.checked })}
              />
              <label htmlFor="isTrashCollection" className="text-sm font-medium text-gray-700">ゴミ回収</label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">価格改定日</label>
                <input 
                  type="date" 
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none" 
                  value={formData.priceRevisionDate} 
                  onChange={(e) => setFormData({ ...formData, priceRevisionDate: e.target.value })} 
                />
             </div>
             <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">訪問頻度</label>
                <select 
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.visitFrequency || ''}
                  onChange={(e) => setFormData({ ...formData, visitFrequency: e.target.value as any })}
                >
                  <option value="">選択してください</option>
                  {VISIT_FREQUENCIES.map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
             </div>
          </div>

          <div>
             <label className="block text-sm font-medium text-gray-700 mb-1">ロケーション</label>
             <div className="flex gap-4 mt-1">
               <label className="flex items-center gap-2 cursor-pointer">
                 <input 
                   type="radio" 
                   name="locationType" 
                   value="インロケ"
                   checked={formData.locationType === 'インロケ'}
                   onChange={() => setFormData({ ...formData, locationType: 'インロケ' })}
                   className="text-blue-600 focus:ring-blue-500"
                 />
                 <span className="text-sm text-gray-700">インロケ</span>
               </label>
               <label className="flex items-center gap-2 cursor-pointer">
                 <input 
                   type="radio" 
                   name="locationType" 
                   value="アウトロケ"
                   checked={formData.locationType === 'アウトロケ'}
                   onChange={() => setFormData({ ...formData, locationType: 'アウトロケ' })}
                   className="text-blue-600 focus:ring-blue-500"
                 />
                 <span className="text-sm text-gray-700">アウトロケ</span>
               </label>
             </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">住所</label>
            <input type="text" className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">備考欄</label>
            <textarea className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none" rows={3} value={formData.remarks} onChange={(e) => setFormData({ ...formData, remarks: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200">キャンセル</button>
            <button type="submit" className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700">保存</button>
          </div>
        </form>
      </div>
    </div>
  );
};

