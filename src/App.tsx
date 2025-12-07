import { useState } from 'react';
import { Layout } from './components/Layout';
import { SortableCustomerList } from './components/SortableCustomerList';
import { CustomerForm } from './components/CustomerForm';
import { CSVImport } from './components/CSVImport';
import { CSVExport } from './components/CSVExport';
import { useStore } from './store/useStore';
import { DayOfWeek, Customer, DAYS_OF_WEEK } from './types';
import { Plus, Trash2, CheckSquare, X, ArrowRightLeft, Copy, Search, Filter } from 'lucide-react';
import { 
  DndContext, 
  pointerWithin,
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
  
  // Selection mode state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [showPriceRevisionOnly, setShowPriceRevisionOnly] = useState(false);

  const { 
    customers, 
    schedules, 
    addCustomer, 
    updateCustomer, 
    importCustomers, 
    updateSchedule,
    clearSchedule,
    copyCustomerToDay,
    moveCustomerToDay,
    removeFromSchedule,
    moveCustomersToDay,
    copyCustomersToDay
  } = useStore();

  const currentDaySchedule = schedules[currentDay] || [];
  
  // Determine base list: Search Results (Global) or Current Day Schedule
  const baseCustomers = searchQuery
    ? Object.values(customers).filter(c => 
        c.name.includes(searchQuery) || c.customerNumber.includes(searchQuery)
      )
    : currentDaySchedule.map(id => customers[id]).filter(Boolean);

  // Apply Filter (Price Revision)
  const displayedCustomers = showPriceRevisionOnly
    ? baseCustomers.filter(c => c.priceRevisionDate)
    : baseCustomers;

  const existingNumbers = Object.values(customers).map(c => c.customerNumber);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleImport = (data: Omit<Customer, 'id'>[]) => importCustomers(data, currentDay);
  
  const handleDragStart = (event: any) => {
    if (isSelectionMode || searchQuery) return; // Disable drag in selection or search mode
    setActiveId(event.active.id);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;
    if (isSelectionMode || searchQuery) return; // Disable drag in selection or search mode

    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);

    if (overIdStr.startsWith('tab-')) {
      const targetDay = overIdStr.replace('tab-', '') as DayOfWeek;
      if (targetDay !== currentDay) {
        moveCustomerToDay(activeIdStr, targetDay);
        return;
      }
    }

    if (activeIdStr !== overIdStr) {
      const oldIndex = baseCustomers.findIndex((c) => c.id === activeIdStr);
      const newIndex = baseCustomers.findIndex((c) => c.id === overIdStr);
      if (oldIndex !== -1 && newIndex !== -1) {
        // Only update schedule if we are NOT in search mode (which is guaranteed by the check above)
        const newOrder = arrayMove(baseCustomers, oldIndex, newIndex);
        updateSchedule(currentDay, newOrder.map(c => c.id));
      }
    }
  };

  const handleEdit = (customer: Customer) => { setEditingCustomer(customer); setIsFormOpen(true); };
  
  // Note: logic might need review for search mode delete, but sticking to requested "remove from schedule"
  const handleDelete = (id: string) => { 
    if (searchQuery) {
       if(window.confirm('検索結果からの削除は、現在の曜日のスケジュールから削除されますが、よろしいですか？')) {
         removeFromSchedule(currentDay, id);
       }
    } else {
      removeFromSchedule(currentDay, id); 
    }
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

  // Selection Handlers
  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedIds(new Set());
  };

  const handleToggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedIds(newSelected);
  };

  const handleBulkMove = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const targetDay = e.target.value as DayOfWeek;
    if (targetDay && selectedIds.size > 0) {
       if (window.confirm(`選択した${selectedIds.size}件を${targetDay}${targetDay !== 'その他' ? '曜日' : ''}に移動しますか？`)) {
         moveCustomersToDay(Array.from(selectedIds), targetDay);
         setIsSelectionMode(false);
         setSelectedIds(new Set());
       }
       e.target.value = "";
    }
  };

  const handleBulkCopy = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const targetDay = e.target.value as DayOfWeek;
    if (targetDay && selectedIds.size > 0) {
       if (window.confirm(`選択した${selectedIds.size}件を${targetDay}${targetDay !== 'その他' ? '曜日' : ''}に複製しますか？`)) {
         copyCustomersToDay(Array.from(selectedIds), targetDay);
         setIsSelectionMode(false);
         setSelectedIds(new Set());
       }
       e.target.value = "";
    }
  };

  const activeCustomer = activeId ? customers[activeId] : null;

  return (
    <DndContext 
      sensors={sensors} 
      collisionDetection={pointerWithin} 
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <Layout currentDay={currentDay} onDayChange={setCurrentDay} headerActions={
        <>
          {/* Search & Filter - Always Visible (or responsive) */}
          <div className="flex items-center gap-1 md:gap-2 mr-1 md:mr-2 bg-white p-1 rounded-md border border-gray-200">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" size={14} />
              <input
                type="text"
                placeholder="検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-7 pr-2 py-1 text-xs md:text-sm border-none bg-transparent focus:outline-none w-24 md:w-32 lg:w-40"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-1 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X size={12} />
                </button>
              )}
            </div>
            <div className="h-4 w-px bg-gray-200 mx-1"></div>
            <button
              onClick={() => setShowPriceRevisionOnly(!showPriceRevisionOnly)}
              className={`p-1 rounded transition-colors flex items-center gap-1 ${
                showPriceRevisionOnly
                  ? 'bg-orange-100 text-orange-600'
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
              }`}
              title="価格改定ありのみ表示"
            >
              <Filter size={16} />
              <span className="text-[10px] md:text-xs font-medium hidden sm:inline">改定のみ</span>
            </button>
          </div>

          {isSelectionMode ? (
            <>
              <div className="flex items-center gap-2 mr-2 bg-blue-50 px-3 py-1.5 rounded-md border border-blue-100 text-blue-700 text-sm font-bold whitespace-nowrap">
                 <CheckSquare size={16} /> <span className="hidden sm:inline">{selectedIds.size}件</span><span className="inline sm:hidden">{selectedIds.size}</span>
              </div>
              
              <div className="relative flex items-center justify-center gap-1 md:gap-2 px-3 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 transition-colors shadow-sm text-xs md:text-sm font-medium whitespace-nowrap cursor-pointer">
                <ArrowRightLeft size={16} className="md:w-[18px] md:h-[18px]" />
                <span className="hidden sm:inline">移動</span>
                <span className="inline sm:hidden">移動</span>
                <select 
                  className="absolute inset-0 opacity-0 cursor-pointer text-gray-900" 
                  onChange={handleBulkMove}
                  value=""
                >
                  <option value="" disabled>移動先を選択</option>
                  {DAYS_OF_WEEK.map(day => (
                     <option key={day} value={day}>{day}</option>
                  ))}
                </select>
              </div>

              <div className="relative flex items-center justify-center gap-1 md:gap-2 px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors shadow-sm text-xs md:text-sm font-medium whitespace-nowrap cursor-pointer">
                <Copy size={16} className="md:w-[18px] md:h-[18px]" />
                <span className="hidden sm:inline">複製</span>
                <span className="inline sm:hidden">複製</span>
                <select 
                  className="absolute inset-0 opacity-0 cursor-pointer text-gray-900" 
                  onChange={handleBulkCopy}
                  value=""
                >
                  <option value="" disabled>複製先を選択</option>
                  {DAYS_OF_WEEK.map(day => (
                     <option key={day} value={day}>{day}</option>
                  ))}
                </select>
              </div>

              <button onClick={toggleSelectionMode} className="flex items-center justify-center gap-1 md:gap-2 px-3 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors shadow-sm text-xs md:text-sm font-medium whitespace-nowrap border-0 cursor-pointer appearance-none">
                <X size={16} className="md:w-[18px] md:h-[18px]" />
                <span>完了</span>
              </button>
            </>
          ) : (
            <>
              <button onClick={toggleSelectionMode} className="flex items-center justify-center gap-1 md:gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors shadow-sm text-xs md:text-sm font-medium whitespace-nowrap border border-gray-300 cursor-pointer appearance-none">
                <CheckSquare size={16} className="md:w-[18px] md:h-[18px]" />
                <span className="hidden sm:inline">複数選択</span>
              </button>
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
          )}
        </>
      }>
        <SortableCustomerList 
          customers={displayedCustomers} 
          onEdit={handleEdit} 
          onDelete={handleDelete}
          onCopy={handleCopy}
          isSelectionMode={isSelectionMode}
          selectedIds={selectedIds}
          onToggleSelection={handleToggleSelection}
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
