import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Customer, DayOfWeek } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface StoreState {
  customers: Record<string, Customer>;
  schedules: Record<DayOfWeek, string[]>;
  addCustomer: (customer: Omit<Customer, 'id'>, day?: DayOfWeek) => void;
  updateCustomer: (id: string, customer: Partial<Customer>) => void;
  importCustomers: (customers: Omit<Customer, 'id'>[], targetDay?: DayOfWeek) => void;
  updateSchedule: (day: DayOfWeek, customerIds: string[]) => void;
  removeFromSchedule: (day: DayOfWeek, customerId: string) => void;
  getCustomer: (id: string) => Customer | undefined;
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      customers: {},
      schedules: { '月': [], '火': [], '水': [], '木': [], '金': [] },
      addCustomer: (customerData, day) => {
        const id = uuidv4();
        const newCustomer = { ...customerData, id };
        set((state) => {
          const newState = {
            customers: { ...state.customers, [id]: newCustomer },
            schedules: { ...state.schedules }
          };
          if (day) newState.schedules[day] = [...newState.schedules[day], id];
          return newState;
        });
      },
      updateCustomer: (id, updates) => {
        set((state) => ({
          customers: { ...state.customers, [id]: { ...state.customers[id], ...updates } },
        }));
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
      removeFromSchedule: (day, customerId) => {
        set((state) => ({
          schedules: { ...state.schedules, [day]: state.schedules[day].filter(id => id !== customerId) }
        }));
      },
      getCustomer: (id) => get().customers[id],
    }),
    { name: 'customer-manager-storage' }
  )
);
