import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Customer, DAYS_OF_WEEK, DayOfWeek } from '../types';
import { GripVertical, Pencil, Trash2, Copy } from 'lucide-react';
import clsx from 'clsx';

interface Props {
  customer: Customer;
  index: number;
  onEdit: (customer: Customer) => void;
  onDelete: (id: string) => void;
  onCopy: (id: string, targetDay: DayOfWeek) => void;
}

export const CustomerCard: React.FC<Props> = ({ customer, index, onEdit, onDelete, onCopy }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: customer.id });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : 'auto',
    opacity: isDragging ? 0.5 : 1,
    position: 'relative' as const,
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`「${customer.name}」を削除してもよろしいですか？`)) {
      onDelete(customer.id);
    }
  };

  const handleCopyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation();
    const targetDay = e.target.value as DayOfWeek;
    if (targetDay) {
      if (window.confirm(`「${customer.name}」を${targetDay}${targetDay !== 'その他' ? '曜日' : ''}に複製しますか？`)) {
        onCopy(customer.id, targetDay);
      }
      e.target.value = ""; // Reset select
    }
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={clsx(
        "p-3 rounded-lg shadow-sm border border-gray-200 flex items-center gap-3 mb-2 group hover:shadow-md transition-shadow",
        customer.isCorporate ? 'bg-cyan-50' : 'bg-white'
      )}
    >
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 text-gray-400 hover:text-gray-600 touch-none">
        <GripVertical size={20} />
      </div>
      
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm">
        {index + 1}
      </div>
      
      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
        <div className="md:col-span-2 font-mono text-sm text-gray-600 flex items-center">
           <span className="md:hidden text-xs text-gray-400 mr-2">No.</span>{customer.customerNumber}
        </div>
        <div className="md:col-span-3 font-medium text-gray-900">
          {customer.name}
          {customer.visitFrequency && (
            <span className="ml-2 text-xs px-1.5 py-0.5 bg-gray-100 rounded-md text-gray-600 border border-gray-200">
              {customer.visitFrequency}
            </span>
          )}
        </div>
        <div className="md:col-span-4 text-sm text-gray-600 truncate">
           {customer.address}
        </div>
        <div className="md:col-span-3 text-sm text-gray-500 flex items-center gap-2 overflow-hidden">
           {customer.locationType && <span className="text-xs bg-gray-100 px-1 rounded text-gray-600 flex-shrink-0">{customer.locationType}</span>}
           <span title={customer.remarks} className="truncate flex-1">{customer.remarks}</span>
           {customer.priceRevisionDate && (
             <span className="text-xs bg-orange-50 text-orange-700 border border-orange-200 px-1.5 py-0.5 rounded flex-shrink-0 whitespace-nowrap" title="価格改定日">
               {customer.priceRevisionDate}
             </span>
           )}
        </div>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="relative p-2 text-gray-400 hover:text-green-600 transition-colors" title="複製">
          <Copy size={18} />
          <select 
            className="absolute inset-0 opacity-0 cursor-pointer" 
            onChange={handleCopyChange}
            value=""
            onClick={(e) => e.stopPropagation()}
          >
            <option value="" disabled>複製先を選択</option>
            {DAYS_OF_WEEK.map(day => (
              <option key={day} value={day}>{day}</option>
            ))}
          </select>
        </div>
        <button onClick={() => onEdit(customer)} className="p-2 text-gray-400 hover:text-blue-600 transition-colors" title="編集">
          <Pencil size={18} />
        </button>
        <button onClick={handleDeleteClick} className="p-2 text-gray-400 hover:text-red-600 transition-colors" title="削除">
          <Trash2 size={18} />
        </button>
      </div>
    </div>
  );
};
