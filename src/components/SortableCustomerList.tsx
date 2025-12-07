import React from 'react';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CustomerCard } from './CustomerCard';
import { Customer, DayOfWeek } from '../types';

interface Props {
  customers: Customer[];
  onEdit: (customer: Customer) => void;
  onDelete: (id: string) => void;
  onCopy: (id: string, targetDay: DayOfWeek) => void;
  isSelectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelection?: (id: string) => void;
  stats?: {
    total: number;
    revised: number;
    notRevised: number;
    rate: number;
  };
  filterMode?: 'all' | 'revised' | 'notRevised';
}

export const SortableCustomerList: React.FC<Props> = ({ 
  customers, 
  onEdit, 
  onDelete, 
  onCopy,
  isSelectionMode,
  selectedIds,
  onToggleSelection,
  stats,
  filterMode
}) => {
  return (
    <SortableContext items={customers.map(c => c.id)} strategy={verticalListSortingStrategy}>
      <div className="space-y-2 pb-20">
        {filterMode === 'revised' && stats && (
          <div className="bg-orange-50 border border-orange-200 rounded-md p-3 mb-4 text-sm text-orange-800 flex items-center justify-between sm:justify-start sm:gap-6">
            <div className="flex items-center gap-2">
              <span className="text-orange-600">実施状況:</span>
              <span className="font-bold text-base">{stats.revised}件</span>
              <span className="text-gray-400">/</span>
              <span className="font-medium text-gray-600">{stats.total}件</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-orange-600">改定率:</span>
              <span className="font-bold text-lg">{stats.rate}%</span>
            </div>
          </div>
        )}

        <div className="hidden md:grid grid-cols-12 gap-2 px-16 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
          <div className="col-span-2">得意先番号</div>
          <div className="col-span-3">顧客名</div>
          <div className="col-span-4">住所</div>
          <div className="col-span-3">備考</div>
        </div>
        {customers.map((customer, index) => (
          <CustomerCard 
            key={customer.id} 
            customer={customer} 
            index={index} 
            onEdit={onEdit} 
            onDelete={onDelete} 
            onCopy={onCopy}
            isSelectionMode={isSelectionMode}
            isSelected={selectedIds?.has(customer.id)}
            onToggleSelection={onToggleSelection}
          />
        ))}
        {customers.length === 0 && (
            <div className="text-center py-10 text-gray-500 bg-white rounded-lg border border-dashed border-gray-300">
              この曜日の訪問予定はありません。<br/>「新規追加」または「取込」で追加してください。
            </div>
        )}
      </div>
    </SortableContext>
  );
};
