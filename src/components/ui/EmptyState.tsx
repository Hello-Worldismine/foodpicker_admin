import { Search } from 'lucide-react';

interface EmptyStateProps {
  message?: string;
}

export default function EmptyState({ message = '데이터가 없습니다.' }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
      <Search size={40} className="mb-3 opacity-30" />
      <p className="text-sm">{message}</p>
    </div>
  );
}
