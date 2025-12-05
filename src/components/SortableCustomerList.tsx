import React from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CustomerCard } from './CustomerCard';
import { Customer } from '../types';

interface Props {
  customers: Customer[];
  onReorder: (newOrderIds: string[]) => void;
  onEdit: (customer: Customer) => void;
  onDelete: (id: string) => void;
}

export const SortableCustomerList: React.FC<Props> = ({ customers, onReorder, onEdit, onDelete }) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = customers.findIndex((c) => c.id === active.id);
      const newIndex = customers.findIndex((c) => c.id === over.id);
      const newOrder = arrayMove(customers, oldIndex, newIndex);
      onReorder(newOrder.map(c => c.id));
    }
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={customers.map(c => c.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2 pb-20">
          <div className="hidden md:grid grid-cols-12 gap-2 px-16 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            <div className="col-span-2">得意先番号</div>
            <div className="col-span-3">顧客名</div>
            <div className="col-span-4">住所</div>
            <div className="col-span-3">備考</div>
          </div>
          {customers.map((customer, index) => (
            <CustomerCard key={customer.id} customer={customer} index={index} onEdit={onEdit} onDelete={onDelete} />
          ))}
          {customers.length === 0 && (
             <div className="text-center py-10 text-gray-500 bg-white rounded-lg border border-dashed border-gray-300">
               この曜日の訪問予定はありません。<br/>「新規顧客追加」または「CSVインポート」で追加してください。
             </div>
          )}
        </div>
      </SortableContext>
    </DndContext>
  );
};
