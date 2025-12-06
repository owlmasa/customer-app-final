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
    deleteCustomer, 
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

    // If dropped on a tab (move to another day)
    if (String(over.id).startsWith('tab-')) {
      const targetDay = String(over.id).replace('tab-', '') as DayOfWeek;
      if (targetDay !== currentDay) {
        moveCustomerToDay(active.id as string, targetDay);
        return;
      }
    }

    // If dropped within the list (reorder)
    if (active.id !== over.id) {
      const oldIndex = scheduledCustomers.findIndex((c) => c.id === active.id);
      const newIndex = scheduledCustomers.findIndex((c) => c.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(scheduledCustomers, oldIndex, newIndex);
        updateSchedule(currentDay, newOrder.map(c => c.id));
      }
    }
  };

  const handleEdit = (customer: Customer) => { setEditingCustomer(customer); setIsFormOpen(true); };
  const handleDelete = (id: string) => { deleteCustomer(id); };
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
