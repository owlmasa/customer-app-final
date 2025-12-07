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
}

export const SortableCustomerList: React.FC<Props> = ({ 
  customers, 
  onEdit, 
  onDelete, 
  onCopy,
  isSelectionMode,
  selectedIds,
  onToggleSelection
}) => {
  return (
    <SortableContext items={customers.map(c => c.id)} strategy={verticalListSortingStrategy}>
      <div className="space-y-2 pb-20">
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
