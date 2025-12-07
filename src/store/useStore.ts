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
  
  // Bulk operations
  copyCustomersToDay: (customerIds: string[], targetDay: DayOfWeek) => void;
  moveCustomersToDay: (customerIds: string[], targetDay: DayOfWeek) => void;
  
  getCustomer: (id: string) => Customer | undefined;
  removeFromSchedule: (day: DayOfWeek, customerId: string) => void;
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      customers: {},
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
          const existingByNumber = Object.values(state.customers).reduce((acc, c) => {
            acc[c.customerNumber] = c.id;
            return acc;
          }, {} as Record<string, string>);
          
          const newIds: string[] = [];
          
          newCustomersData.forEach(c => {
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
          return {
            schedules: { ...state.schedules, [day]: [] }
          };
        });
      },
      
      copyCustomerToDay: (customerId, targetDay) => {
        const state = get();
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
          DAYS_OF_WEEK.forEach(day => {
            newSchedules[day] = newSchedules[day].filter(id => id !== customerId);
          });
          if (!newSchedules[targetDay]) newSchedules[targetDay] = [];
          newSchedules[targetDay] = [...newSchedules[targetDay], customerId];
          return { schedules: newSchedules };
        });
      },

      copyCustomersToDay: (customerIds, targetDay) => {
        set((state) => {
          const newSchedules = { ...state.schedules };
          if (!newSchedules[targetDay]) newSchedules[targetDay] = [];
          
          const toAdd = customerIds.filter(id => !newSchedules[targetDay].includes(id));
          newSchedules[targetDay] = [...newSchedules[targetDay], ...toAdd];
          
          return { schedules: newSchedules };
        });
      },

      moveCustomersToDay: (customerIds, targetDay) => {
        set((state) => {
          const newSchedules = { ...state.schedules };
          
          // Remove from all days first (except target if we want to be clever, but filtering all is safer for "move")
          DAYS_OF_WEEK.forEach(day => {
             newSchedules[day] = newSchedules[day].filter(id => !customerIds.includes(id));
          });
          
          // Add to target day
          if (!newSchedules[targetDay]) newSchedules[targetDay] = [];
          newSchedules[targetDay] = [...newSchedules[targetDay], ...customerIds];
          
          return { schedules: newSchedules };
        });
      },
      
      getCustomer: (id) => get().customers[id],
      removeFromSchedule: (day, customerId) => {
        set((state) => ({
          schedules: { ...state.schedules, [day]: state.schedules[day].filter(id => id !== customerId) }
        }));
      }
    }),
    { name: 'customer-manager-storage' }
  )
);
