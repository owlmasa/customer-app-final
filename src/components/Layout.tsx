import React from 'react';
import { DayOfWeek, DAYS_OF_WEEK } from '../types';
import clsx from 'clsx';
import { MapPin } from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';

interface Props {
  currentDay: DayOfWeek;
  onDayChange: (day: DayOfWeek) => void;
  children: React.ReactNode;
  headerActions?: React.ReactNode;
  dayCounts: Record<DayOfWeek, number>;
}

const DroppableTab = ({ day, currentDay, onClick, count }: { day: DayOfWeek, currentDay: DayOfWeek, onClick: () => void, count: number }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `tab-${day}`,
    data: { day }
  });

  return (
    <button
      ref={setNodeRef}
      onClick={onClick}
      className={clsx(
        day === currentDay ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
        isOver ? 'bg-blue-50 border-blue-300' : '',
        'whitespace-nowrap py-3 md:py-4 px-3 border-b-2 font-medium text-sm flex-shrink-0 text-center transition-colors'
      )}
    >
      {day}
      {day !== 'その他' && '曜日'}
      <span className="ml-1.5 text-xs text-gray-400 font-normal">({count})</span>
    </button>
  );
};

export const Layout: React.FC<Props> = ({ currentDay, onDayChange, children, headerActions, dayCounts }) => {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white shadow-sm z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center py-3 md:h-16 md:py-0 gap-3">
            <div className="flex items-center gap-2 w-full md:w-auto justify-center md:justify-start">
              <div className="bg-blue-600 p-2 rounded text-white flex-shrink-0"><MapPin size={20} className="md:w-6 md:h-6" /></div>
              <h1 className="text-lg md:text-xl font-bold text-gray-900 truncate">ルートセールス訪問一覧</h1>
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto justify-center md:justify-end overflow-x-auto no-scrollbar pb-1 md:pb-0">
              {headerActions}
            </div>
          </div>
        </div>
      </header>
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="-mb-px flex overflow-x-auto no-scrollbar" aria-label="Tabs">
            {DAYS_OF_WEEK.map((day) => (
              <DroppableTab 
                key={day} 
                day={day} 
                currentDay={currentDay} 
                onClick={() => onDayChange(day)} 
                count={dayCounts[day] || 0}
              />
            ))}
          </nav>
        </div>
      </div>
      <main className="flex-1 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-8">{children}</div>
      </main>
    </div>
  );
};

