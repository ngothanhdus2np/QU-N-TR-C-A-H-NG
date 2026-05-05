
import React from 'react';
import { motion } from 'framer-motion';

interface SkeletonProps {
  className?: string;
  count?: number;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = "", count = 1 }) => {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0.5 }}
          animate={{ opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          className={`bg-slate-200 rounded-lg ${className}`}
        />
      ))}
    </>
  );
};

export const TableSkeleton: React.FC = () => (
  <div className="w-full space-y-4">
    <Skeleton className="h-12 w-full" />
    <div className="space-y-2">
      <Skeleton className="h-10 w-full" count={5} />
    </div>
  </div>
);

export const CardSkeleton: React.FC = () => (
  <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
    <div className="flex items-center gap-3">
      <Skeleton className="w-10 h-10 rounded-full" />
      <Skeleton className="h-4 w-24" />
    </div>
    <Skeleton className="h-8 w-1/2" />
    <Skeleton className="h-20 w-full" />
  </div>
);
