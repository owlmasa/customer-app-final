import { useState } from 'react';
import { Layout } from './components/Layout';
import { SortableCustomerList } from './components/SortableCustomerList';
import { CustomerForm } from './components/CustomerForm';
import { CSVImport } from './components/CSVImport';
import { CSVExport } from './components/CSVExport';
import { useStore } from './store/useStore';
import { DayOfWeek, Customer } from './types';
import { Plus, Trash2 } from 'lucide-react';
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors, 
  DragEndEvent,
  DragOverlay
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { CustomerCard } from './components/CustomerCard';

function App() {
  const [currentDay, setCurrentDay] = useState<DayOfWeek>('月');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | undefined>(undefined);
  const [activeId, setActiveId] = useState<string | null>(null);
  
  const { 
    customers, 
    schedules, 
    addCustomer, 
    updateCustomer, 
    importCustomers, 
    updateSchedule,
    clearSchedule,
    copyCustomerToDay,
    moveCustomerToDay
  } = useStore();

  const currentDaySchedule = schedules[currentDay] || [];
  const scheduledCustomers = currentDaySchedule.map(id => customers[id]).filter(Boolean);
  const existingNumbers = Object.values(customers).map(c => c.customerNumber);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleImport = (data: Omit<Customer, 'id'>[]) => importCustomers(data, currentDay);
  
  const handleDragStart = (event: any) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);

    // If dropped on a tab (move to another day)
    if (overIdStr.startsWith('tab-')) {
      const targetDay = overIdStr.replace('tab-', '') as DayOfWeek;
      if (targetDay !== currentDay) {
        moveCustomerToDay(activeIdStr, targetDay);
        return;
      }
    }

    // If dropped within the list (reorder)
    if (activeIdStr !== overIdStr) {
      const oldIndex = scheduledCustomers.findIndex((c) => c.id === activeIdStr);
      const newIndex = scheduledCustomers.findIndex((c) => c.id === overIdStr);
      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(scheduledCustomers, oldIndex, newIndex);
        updateSchedule(currentDay, newOrder.map(c => c.id));
      }
    }
  };

  const handleEdit = (customer: Customer) => { setEditingCustomer(customer); setIsFormOpen(true); };
  
  // For single delete, we probably just want to remove from THIS day, not globally,
  // unless the user explicitly wants to delete the customer record.
  // Based on the "clearSchedule" fix, let's assume the user wants to remove the schedule item.
  // But if they click the trash can on a card, they might mean "delete this visit".
  // I'll change this to remove from schedule only, to match the "clear" behavior logic.
  const handleDelete = (id: string) => { 
      // We need a new function in store for "remove single from schedule" vs "delete customer"
      // For now, I'll use a direct store manipulation via a new action or existing one.
      // Wait, useStore has removeFromSchedule? No, I removed it.
      // Let's add it back or use deleteCustomer (which wipes everything).
      // User complained about "deleting Mon when deleting Wed".
      // So I should implement "removeFromCurrentSchedule" instead of global delete.
      // But wait, I already modified clearSchedule to only clear the schedule.
      // Let's modify deleteCustomer to only remove from ALL schedules if it's global,
      // OR create a new function "removeCustomerFromDay".
      
      // Actually, the previous deleteCustomer removed from ALL days.
      // If I want to remove only from THIS day, I need to filter schedules[currentDay].
      // Let's implement a local removal.
      const newIds = currentDaySchedule.filter(cId => cId !== id);
      updateSchedule(currentDay, newIds);
  };

  const handleCopy = (id: string, targetDay: DayOfWeek) => { copyCustomerToDay(id, targetDay); };
  const handleAdd = () => { setEditingCustomer(undefined); setIsFormOpen(true); };
  const handleFormSubmit = (data: Omit<Customer, 'id'>) => {
    if (editingCustomer) updateCustomer(editingCustomer.id, data);
    else addCustomer(data, currentDay);
  };
  const handleClearSchedule = () => {
    if (window.confirm(`${currentDay}${currentDay !== 'その他' ? '曜日' : ''}のデータを全て削除しますか？この操作は取り消せません。`)) {
      clearSchedule(currentDay);
    }
  };

  const activeCustomer = activeId ? customers[activeId] : null;

  return (
    <DndContext 
      sensors={sensors} 
      collisionDetection={closestCenter} 
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <Layout currentDay={currentDay} onDayChange={setCurrentDay} headerActions={
        <>
          <CSVExport customers={Object.values(customers)} />
          <CSVImport onImport={handleImport} />
          <button onClick={handleClearSchedule} className="flex items-center justify-center gap-1 md:gap-2 px-3 py-2 bg-red-100 text-red-600 rounded-md hover:bg-red-200 transition-colors shadow-sm text-xs md:text-sm font-medium whitespace-nowrap border-0 cursor-pointer appearance-none" title="一括削除">
            <Trash2 size={16} className="md:w-[18px] md:h-[18px]" />
            <span className="hidden sm:inline">一括削除</span>
          </button>
          <button onClick={handleAdd} className="flex items-center justify-center gap-1 md:gap-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors shadow-sm text-xs md:text-sm font-medium whitespace-nowrap border-0 cursor-pointer appearance-none">
            <Plus size={16} className="md:w-[18px] md:h-[18px]" /> 
            <span className="hidden sm:inline">新規追加</span>
            <span className="inline sm:hidden">追加</span>
          </button>
        </>
      }>
        <SortableCustomerList 
          customers={scheduledCustomers} 
          onEdit={handleEdit} 
          onDelete={handleDelete}
          onCopy={handleCopy}
        />
        <CustomerForm isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} onSubmit={handleFormSubmit} initialData={editingCustomer} existingNumbers={existingNumbers} />
      </Layout>
      <DragOverlay>
        {activeCustomer ? (
          <div className="opacity-80 rotate-2 scale-105 pointer-events-none">
             <CustomerCard customer={activeCustomer} index={0} onEdit={() => {}} onDelete={() => {}} onCopy={() => {}} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
export default App;
