import React from 'react';
import { DayOfWeek, DAYS_OF_WEEK } from '../types';
import clsx from 'clsx';
import { MapPin } from 'lucide-react';

interface Props {
  currentDay: DayOfWeek;
  onDayChange: (day: DayOfWeek) => void;
  children: React.ReactNode;
  headerActions?: React.ReactNode;
}

export const Layout: React.FC<Props> = ({ currentDay, onDayChange, children, headerActions }) => {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white shadow-sm z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="bg-blue-600 p-2 rounded text-white"><MapPin size={24} /></div>
              <h1 className="text-xl font-bold text-gray-900">ルートセールス訪問一覧</h1>
            </div>
            <div className="flex items-center gap-4">{headerActions}</div>
          </div>
        </div>
      </header>
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="-mb-px flex space-x-8 overflow-x-auto" aria-label="Tabs">
            {DAYS_OF_WEEK.map((day) => (
              <button key={day} onClick={() => onDayChange(day)} className={clsx(day === currentDay ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300', 'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex-1 text-center transition-colors')}>
                {day}曜日
              </button>
            ))}
          </nav>
        </div>
      </div>
      <main className="flex-1 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</div>
      </main>
    </div>
  );
};
