import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, X } from 'lucide-react';

interface ToastProps {
  message: string;
  type: 'success' | 'error';
  onClose?: () => void;
}

export default function Toast({ message, type, onClose }: ToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger enter animation
    requestAnimationFrame(() => setVisible(true));
  }, []);

  return (
    <div
      className={`fixed bottom-6 right-6 z-[100] flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm transition-all duration-300 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      } ${
        type === 'success'
          ? 'bg-white border-primary/20 text-charcoal'
          : 'bg-white border-alert-red/20 text-charcoal'
      }`}
    >
      {type === 'success'
        ? <CheckCircle size={18} className="text-primary flex-shrink-0 mt-0.5" />
        : <XCircle size={18} className="text-alert-red flex-shrink-0 mt-0.5" />
      }
      <p className="text-sm flex-1">{message}</p>
      {onClose && (
        <button onClick={onClose} className="text-gray-300 hover:text-gray-500 flex-shrink-0">
          <X size={15} />
        </button>
      )}
    </div>
  );
}
