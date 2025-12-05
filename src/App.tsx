import { useState } from 'react';
import { Layout } from './components/Layout';
import { SortableCustomerList } from './components/SortableCustomerList';
import { CustomerForm } from './components/CustomerForm';
import { CSVImport } from './components/CSVImport';
import { CSVExport } from './components/CSVExport';
import { useStore } from './store/useStore';
import { DayOfWeek, Customer } from './types';
import { Plus } from 'lucide-react';

function App() {
  const [currentDay, setCurrentDay] = useState<DayOfWeek>('月');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | undefined>(undefined);
  const { customers, schedules, addCustomer, updateCustomer, deleteCustomer, importCustomers, updateSchedule } = useStore();

  const currentDaySchedule = schedules[currentDay] || [];
  const scheduledCustomers = currentDaySchedule.map(id => customers[id]).filter(Boolean);
  const existingNumbers = Object.values(customers).map(c => c.customerNumber);

  const handleImport = (data: Omit<Customer, 'id'>[]) => importCustomers(data, currentDay);
  const handleReorder = (newOrderIds: string[]) => updateSchedule(currentDay, newOrderIds);
  const handleEdit = (customer: Customer) => { setEditingCustomer(customer); setIsFormOpen(true); };
  const handleDelete = (id: string) => { deleteCustomer(id); };
  const handleAdd = () => { setEditingCustomer(undefined); setIsFormOpen(true); };
  const handleFormSubmit = (data: Omit<Customer, 'id'>) => {
    if (editingCustomer) updateCustomer(editingCustomer.id, data);
    else addCustomer(data, currentDay);
  };

  return (
    <Layout currentDay={currentDay} onDayChange={setCurrentDay} headerActions={
      <>
        <CSVExport customers={Object.values(customers)} />
        <CSVImport onImport={handleImport} />
        <button onClick={handleAdd} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors shadow-sm text-sm font-medium">
          <Plus size={18} /> 新規追加
        </button>
      </>
    }>
      <SortableCustomerList 
        customers={scheduledCustomers} 
        onReorder={handleReorder} 
        onEdit={handleEdit} 
        onDelete={handleDelete}
      />
      <CustomerForm isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} onSubmit={handleFormSubmit} initialData={editingCustomer} existingNumbers={existingNumbers} />
    </Layout>
  );
}
export default App;
