import React from 'react';

interface EventCardSkeletonProps {
  variant?: 'grid' | 'list' | 'featured';
}

export const EventCardSkeleton: React.FC<EventCardSkeletonProps> = ({
  variant = 'grid',
}) => {
  if (variant === 'featured') {
    return (
      <div className="flex-shrink-0 w-80 sm:w-96 h-64 rounded-2xl overflow-hidden border border-white/10 bg-[#16151A] p-4 flex flex-col justify-between animate-pulse">
        <div className="flex justify-between items-center">
          <div className="h-5 w-20 bg-white/10 rounded-full" />
          <div className="h-6 w-24 bg-[#E9C349]/20 rounded-lg" />
        </div>
        <div className="space-y-2">
          <div className="h-6 w-3/4 bg-white/15 rounded-md" />
          <div className="h-4 w-1/2 bg-white/10 rounded-md" />
          <div className="h-3.5 w-2/3 bg-white/5 rounded-md" />
        </div>
      </div>
    );
  }

  if (variant === 'list') {
    return (
      <div className="glass-panel p-3.5 rounded-2xl flex items-center gap-4 border border-white/5 bg-[#17161C] animate-pulse">
        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-white/10 flex-shrink-0" />
        <div className="flex-1 space-y-2 min-w-0">
          <div className="h-4 w-3/4 bg-white/15 rounded-md" />
          <div className="h-3 w-1/2 bg-white/10 rounded-md" />
          <div className="h-3 w-2/3 bg-white/5 rounded-md" />
        </div>
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <div className="h-4 w-16 bg-[#E9C349]/20 rounded" />
          <div className="h-7 w-20 bg-white/10 rounded-xl" />
        </div>
      </div>
    );
  }

  // Variant 'grid' par défaut
  return (
    <div className="glass-panel rounded-2xl overflow-hidden flex flex-col border border-white/5 bg-[#17161C] shadow-lg animate-pulse">
      {/* Zone Image */}
      <div className="h-44 sm:h-48 relative bg-white/5 flex flex-col justify-between p-3">
        <div className="flex items-center justify-between">
          <div className="h-5 w-16 bg-white/10 rounded-full" />
          <div className="h-5 w-20 bg-[#E9C349]/20 rounded-md" />
        </div>
        <div className="h-5 w-3/4 bg-white/15 rounded-md" />
      </div>

      {/* Zone Infos */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
        <div className="space-y-2">
          <div className="h-3.5 w-1/2 bg-white/10 rounded" />
          <div className="h-3.5 w-2/3 bg-white/5 rounded" />
        </div>

        <div className="pt-2 border-t border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-white/10" />
            <div className="h-3 w-16 bg-white/5 rounded" />
          </div>
          <div className="h-6 w-20 bg-white/10 rounded-lg" />
        </div>
      </div>
    </div>
  );
};
