import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Customer, DAYS_OF_WEEK, DayOfWeek } from '../types';
import { GripVertical, Pencil, Trash2, Copy, ChevronDown, ChevronUp } from 'lucide-react';
import clsx from 'clsx';

interface Props {
  customer: Customer;
  index: number;
  onEdit: (customer: Customer) => void;
  onDelete: (id: string) => void;
  onCopy: (id: string, targetDay: DayOfWeek) => void;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelection?: (id: string) => void;
}

export const CustomerCard: React.FC<Props> = ({ 
  customer, 
  index, 
  onEdit, 
  onDelete, 
  onCopy,
  isSelectionMode = false,
  isSelected = false,
  onToggleSelection
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: customer.id, disabled: isSelectionMode });
  const [isExpanded, setIsExpanded] = useState(false);
  
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

  const handleCardClick = () => {
    if (isSelectionMode && onToggleSelection) {
      onToggleSelection(customer.id);
    } else {
      setIsExpanded(!isExpanded);
    }
  };

  const handleAddressClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card selection/drag
    
    // If in selection mode, do nothing (let the card click handler handle selection if needed, or just ignore)
    // Actually, since we stopped propagation, we might want to manually trigger selection if user clicks address in selection mode.
    // But for now, just preventing the alert is the request.
    // To make it smoother, we can call onToggleSelection here too if in selection mode.
    if (isSelectionMode) {
      if (onToggleSelection) onToggleSelection(customer.id);
      return;
    }

    if (!customer.address) return;

    if (window.confirm('Googleマップを開きますか？')) {
      const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(customer.address)}`;
      window.open(url, '_blank');
    }
  };

  // Mobile Action Buttons Component
  const ActionButtons = () => (
    <div className="flex items-center justify-end gap-3 mt-3 pt-3 border-t border-gray-100">
      <div className="relative flex items-center text-gray-500 hover:text-green-600 transition-colors px-2 py-1 rounded bg-gray-50 border border-gray-200" title="複製">
        <Copy size={16} className="mr-1" />
        <span className="text-xs">複製</span>
        <select 
          className="absolute inset-0 opacity-0 cursor-pointer" 
          onChange={handleCopyChange}
          value=""
          onClick={(e) => e.stopPropagation()}
        >
          <option value="" disabled>複製先</option>
          {DAYS_OF_WEEK.map(day => (
            <option key={day} value={day}>{day}</option>
          ))}
        </select>
      </div>
      <button onClick={(e) => { e.stopPropagation(); onEdit(customer); }} className="flex items-center text-gray-500 hover:text-blue-600 transition-colors px-2 py-1 rounded bg-gray-50 border border-gray-200" title="編集">
        <Pencil size={16} className="mr-1" />
        <span className="text-xs">編集</span>
      </button>
      <button onClick={handleDeleteClick} className="flex items-center text-gray-500 hover:text-red-600 transition-colors px-2 py-1 rounded bg-gray-50 border border-gray-200" title="削除">
        <Trash2 size={16} className="mr-1" />
        <span className="text-xs">削除</span>
      </button>
    </div>
  );

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      onClick={handleCardClick}
      className={clsx(
        "rounded-lg shadow-sm border transition-all bg-white",
        customer.isCorporate ? 'bg-cyan-50' : 'bg-white',
        isSelectionMode ? 'cursor-pointer hover:bg-gray-50' : 'group',
        isSelected ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-50' : 'border-gray-200'
      )}
    >
      <div className="p-3 flex items-start md:items-center gap-2 md:gap-3">
        {/* Drag Handle / Checkbox */}
        {isSelectionMode ? (
          <div className="p-1 pt-1 md:pt-1">
            <div className={clsx(
              "w-5 h-5 rounded border flex items-center justify-center transition-colors",
              isSelected ? "bg-blue-600 border-blue-600" : "border-gray-300 bg-white"
            )}>
              {isSelected && <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>}
            </div>
          </div>
        ) : (
          <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 text-gray-400 hover:text-gray-600 touch-none pt-1 md:pt-0">
            <GripVertical size={20} />
          </div>
        )}
        
        {/* Index Circle */}
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm pt-0 md:pt-0">
          {index + 1}
        </div>
        
        {/* Content Area */}
        <div className="flex-1 min-w-0">
          {/* --- Mobile Optimized View (Grid layout for PC is hidden on mobile) --- */}
          <div className="md:hidden">
            {/* Row 1: Name & Badges */}
            <div className="flex items-center flex-wrap gap-y-1 gap-x-2 mb-1">
              <div className="font-medium text-gray-900 text-sm">{customer.name}</div>
              {customer.visitFrequency && (
                <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 rounded border border-gray-200 whitespace-nowrap text-gray-600">
                  {customer.visitFrequency}
                </span>
              )}
              {customer.priceRevisionDate && (
                <span className="text-[10px] bg-orange-100 text-orange-700 border border-orange-200 px-1.5 py-0.5 rounded whitespace-nowrap">
                  改定済
                </span>
              )}
            </div>
            
            {/* Row 2: Address (Truncated on mobile collapsed) */}
            <div 
              className={clsx(
                "text-xs truncate",
                isSelectionMode ? "text-gray-600" : "text-blue-600 cursor-pointer hover:underline"
              )}
              onClick={handleAddressClick}
            >
               {customer.address}
            </div>

            {/* Expanded Details for Mobile */}
            {isExpanded && (
              <div className="mt-3 pt-2 border-t border-gray-100 text-xs text-gray-600 animate-fade-in">
                <div className="grid grid-cols-1 gap-2">
                  <div className="flex gap-2"><span className="text-gray-400 w-16">No.</span><span className="font-mono">{customer.customerNumber}</span></div>
                  {customer.locationType && <div className="flex gap-2"><span className="text-gray-400 w-16">ロケ</span><span>{customer.locationType}</span></div>}
                  {customer.priceRevisionDate && <div className="flex gap-2"><span className="text-gray-400 w-16">改定日</span><span>{customer.priceRevisionDate}</span></div>}
                  <div className="flex gap-2"><span className="text-gray-400 w-16 flex-shrink-0">備考</span><span className="whitespace-pre-wrap">{customer.remarks}</span></div>
                </div>
                {!isSelectionMode && <ActionButtons />}
              </div>
            )}
          </div>

          {/* --- PC View (Hidden on Mobile) --- */}
          <div className="hidden md:grid grid-cols-12 gap-2 items-center">
            <div className="col-span-2 font-mono text-sm text-gray-600">
               {customer.customerNumber}
            </div>
            <div className="col-span-3 font-medium text-gray-900 flex items-center">
              {customer.name}
              {customer.visitFrequency && (
                <span className="ml-2 text-xs px-1.5 py-0.5 bg-gray-100 rounded-md text-gray-600 border border-gray-200 whitespace-nowrap">
                  {customer.visitFrequency}
                </span>
              )}
            </div>
            <div 
              className={clsx(
                "col-span-4 text-sm truncate",
                isSelectionMode ? "text-gray-600" : "text-blue-600 cursor-pointer hover:underline"
              )}
              onClick={handleAddressClick}
              title={customer.address}
            >
               {customer.address}
            </div>
            <div className="col-span-3 text-sm text-gray-500 flex items-center gap-2 overflow-hidden">
               {customer.locationType && <span className="text-xs bg-gray-100 px-1 rounded text-gray-600 flex-shrink-0">{customer.locationType}</span>}
               <span title={customer.remarks} className="truncate flex-1">{customer.remarks}</span>
               {customer.priceRevisionDate && (
                 <span className="text-xs bg-orange-50 text-orange-700 border border-orange-200 px-1.5 py-0.5 rounded flex-shrink-0 whitespace-nowrap" title="価格改定日">
                   価格改定日: {customer.priceRevisionDate}
                 </span>
               )}
            </div>
          </div>
        </div>

        {/* PC Actions (Right side) - Hidden on Mobile */}
        {!isSelectionMode && (
          <div className="hidden md:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
            <button onClick={(e) => { e.stopPropagation(); onEdit(customer); }} className="p-2 text-gray-400 hover:text-blue-600 transition-colors" title="編集">
              <Pencil size={18} />
            </button>
            <button onClick={handleDeleteClick} className="p-2 text-gray-400 hover:text-red-600 transition-colors" title="削除">
              <Trash2 size={18} />
            </button>
          </div>
        )}
        
        {/* Mobile Expand Icon indicator (Optional, but helpful) */}
        {!isSelectionMode && (
          <div className="md:hidden text-gray-300">
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        )}
      </div>
    </div>
  );
};
