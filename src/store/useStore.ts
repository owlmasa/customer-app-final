import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Customer, DayOfWeek, DAYS_OF_WEEK } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface StoreState {
  customers: Record<string, Customer>;
  schedules: Record<DayOfWeek, string[]>;
  addCustomer: (customer: Omit<Customer, 'id'>, day?: DayOfWeek) => void;
  updateCustomer: (id: string, customer: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;
  importCustomers: (customers: Omit<Customer, 'id'>[], targetDay?: DayOfWeek) => void;
  updateSchedule: (day: DayOfWeek, customerIds: string[]) => void;
  
  clearSchedule: (day: DayOfWeek) => void;
  copyCustomerToDay: (customerId: string, targetDay: DayOfWeek) => void;
  moveCustomerToDay: (customerId: string, targetDay: DayOfWeek) => void;
  
  getCustomer: (id: string) => Customer | undefined;
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      customers: {},
      // Initialize all days including 'その他'
      schedules: DAYS_OF_WEEK.reduce((acc, day) => ({ ...acc, [day]: [] }), {} as Record<DayOfWeek, string[]>),
      
      addCustomer: (customerData, day) => {
        const id = uuidv4();
        const newCustomer = { ...customerData, id };
        set((state) => {
          const newState = {
            customers: { ...state.customers, [id]: newCustomer },
            schedules: { ...state.schedules }
          };
          if (day) {
             // Ensure the array exists
             if (!newState.schedules[day]) newState.schedules[day] = [];
             newState.schedules[day] = [...newState.schedules[day], id];
          }
          return newState;
        });
      },
      
      updateCustomer: (id, updates) => {
        set((state) => ({
          customers: { ...state.customers, [id]: { ...state.customers[id], ...updates } },
        }));
      },
      
      deleteCustomer: (id) => {
        set((state) => {
          // Completely remove the customer from all schedules and the customer map
          const newCustomers = { ...state.customers };
          delete newCustomers[id];
          
          const newSchedules = { ...state.schedules };
          DAYS_OF_WEEK.forEach(day => {
            if (newSchedules[day]) {
              newSchedules[day] = newSchedules[day].filter(customerId => customerId !== id);
            }
          });
          
          return { customers: newCustomers, schedules: newSchedules };
        });
      },
      
      importCustomers: (newCustomersData, targetDay) => {
        set((state) => {
          const newCustomersMap = { ...state.customers };
          
          // Map existing customers by customerNumber to reuse them (preventing duplicates if same number exists)
          // However, the requirement implies duplicates across days should be independent? 
          // User said: "if same data is in Mon and Wed, deleting Wed should not delete Mon".
          // This means we should probably NOT reuse the same ID if it's a different import, OR we treat them as shared references.
          // If they share the ID, deleting by ID deletes everywhere.
          // To solve requirement (1), we should only remove the ID from the specific day's schedule in clearSchedule.
          
          const existingByNumber = Object.values(state.customers).reduce((acc, c) => {
            acc[c.customerNumber] = c.id;
            return acc;
          }, {} as Record<string, string>);
          
          const newIds: string[] = [];
          
          newCustomersData.forEach(c => {
            // If exists, reuse ID (shared reference). If we want them independent, we should always create new ID.
            // But "copy" usually implies independent or shared? 
            // Let's stick to shared ID for same customer number to save space, BUT fix clearSchedule logic.
            if (existingByNumber[c.customerNumber]) {
              const id = existingByNumber[c.customerNumber];
              newCustomersMap[id] = { ...newCustomersMap[id], ...c };
              newIds.push(id);
            } else {
              const id = uuidv4();
              newCustomersMap[id] = { ...c, id };
              newIds.push(id);
            }
          });
          
          const newSchedules = { ...state.schedules };
          if (targetDay) {
            if (!newSchedules[targetDay]) newSchedules[targetDay] = [];
            // Use Set to avoid duplicate IDs in the same day
            const currentList = new Set(newSchedules[targetDay]);
            newIds.forEach(id => currentList.add(id));
            newSchedules[targetDay] = Array.from(currentList);
          }
          return { customers: newCustomersMap, schedules: newSchedules };
        });
      },
      
      updateSchedule: (day, customerIds) => {
        set((state) => ({ schedules: { ...state.schedules, [day]: customerIds } }));
      },
      
      clearSchedule: (day) => {
        set((state) => {
          // Just empty the schedule for that day. Do NOT delete from customers map immediately.
          // We could implement a cleanup later if needed, but keeping the customer record is safer.
          return {
            schedules: { ...state.schedules, [day]: [] }
          };
        });
      },
      
      copyCustomerToDay: (customerId, targetDay) => {
        const state = get();
        // We just add the SAME ID to the target day. 
        // This means it's the SAME customer reference (shared).
        // If the user edits the name in one day, it changes in others. This is usually expected for "same customer".
        // If they want "Clone as new", we would generate new ID.
        // Based on "duplicate", usually means "add this customer to that day too".
        
        // Check if already in target day
        if (state.schedules[targetDay]?.includes(customerId)) return;

        set((state) => ({
          schedules: {
            ...state.schedules,
            [targetDay]: [...(state.schedules[targetDay] || []), customerId]
          }
        }));
      },
      
      moveCustomerToDay: (customerId, targetDay) => {
        const state = get();
        if (state.schedules[targetDay]?.includes(customerId)) {
            // If already there, just remove from others (effectively merge/move)
             set((state) => {
                const newSchedules = { ...state.schedules };
                DAYS_OF_WEEK.forEach(day => {
                    if (day !== targetDay) {
                        newSchedules[day] = newSchedules[day].filter(id => id !== customerId);
                    }
                });
                return { schedules: newSchedules };
            });
            return;
        }

        set((state) => {
          const newSchedules = { ...state.schedules };
          // Remove from all other days
          DAYS_OF_WEEK.forEach(day => {
            newSchedules[day] = newSchedules[day].filter(id => id !== customerId);
          });
          // Add to target day
          if (!newSchedules[targetDay]) newSchedules[targetDay] = [];
          newSchedules[targetDay] = [...newSchedules[targetDay], customerId];
          return { schedules: newSchedules };
        });
      },
      
      getCustomer: (id) => get().customers[id],
    }),
    { name: 'customer-manager-storage' }
  )
);
