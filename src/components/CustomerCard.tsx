import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Customer } from '../types';
import { GripVertical, Pencil } from 'lucide-react';

interface Props {
  customer: Customer;
  index: number;
  onEdit: (customer: Customer) => void;
}

export const CustomerCard: React.FC<Props> = ({ customer, index, onEdit }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: customer.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : 'auto',
    opacity: isDragging ? 0.5 : 1,
    position: 'relative' as const,
  };

  return (
    <div ref={setNodeRef} style={style} className="bg-white p-3 rounded-lg shadow-sm border border-gray-200 flex items-center gap-3 mb-2 group hover:shadow-md transition-shadow">
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 text-gray-400 hover:text-gray-600">
        <GripVertical size={20} />
      </div>
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm">
        {index + 1}
      </div>
      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
        <div className="md:col-span-2 font-mono text-sm text-gray-600 flex items-center">
           <span className="md:hidden text-xs text-gray-400 mr-2">No.</span>{customer.customerNumber}
        </div>
        <div className="md:col-span-3 font-medium text-gray-900">{customer.name}</div>
        <div className="md:col-span-4 text-sm text-gray-600 truncate">{customer.address}</div>
        <div className="md:col-span-3 text-sm text-gray-500 truncate" title={customer.remarks}>{customer.remarks}</div>
      </div>
      <button onClick={() => onEdit(customer)} className="p-2 text-gray-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
        <Pencil size={18} />
      </button>
    </div>
  );
};
