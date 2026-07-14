import { useEffect, useState } from 'react';
import { X, ChevronLeft, ChevronRight, PlayCircle } from 'lucide-react';

export interface LightboxItem {
  type: 'image' | 'video';
  url: string;
  label?: string;
}

interface LightboxProps {
  items: LightboxItem[];
  index: number;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}

export default function Lightbox({ items, index, onClose, onIndexChange }: LightboxProps) {
  const [videoError, setVideoError] = useState(false);
  const current = items[index];

  useEffect(() => { setVideoError(false); }, [index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onIndexChange((index - 1 + items.length) % items.length);
      if (e.key === 'ArrowRight') onIndexChange((index + 1) % items.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, items.length, onClose, onIndexChange]);

  if (!current) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center" onClick={onClose}>
      <button onClick={onClose} className="absolute top-4 right-4 text-white/80 hover:text-white p-2 z-10">
        <X size={24} />
      </button>

      <span className="absolute top-4 left-4 text-white/70 text-sm font-medium">{index + 1} / {items.length}</span>

      {items.length > 1 && (
        <>
          <button
            onClick={e => { e.stopPropagation(); onIndexChange((index - 1 + items.length) % items.length); }}
            className="absolute left-2 sm:left-4 text-white/70 hover:text-white p-2 sm:p-3 bg-white/5 hover:bg-white/10 rounded-full transition-colors"
          >
            <ChevronLeft size={28} />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onIndexChange((index + 1) % items.length); }}
            className="absolute right-2 sm:right-4 text-white/70 hover:text-white p-2 sm:p-3 bg-white/5 hover:bg-white/10 rounded-full transition-colors"
          >
            <ChevronRight size={28} />
          </button>
        </>
      )}

      <div className="max-w-4xl max-h-[80vh] w-full mx-16 flex flex-col items-center gap-3" onClick={e => e.stopPropagation()}>
        {current.type === 'video' ? (
          videoError ? (
            <div className="w-full aspect-video max-h-[75vh] rounded-lg bg-white/10 flex flex-col items-center justify-center gap-2 text-white/70 text-sm">
              <PlayCircle size={32} />
              <p>영상을 재생할 수 없습니다.</p>
            </div>
          ) : (
            <video key={current.url} src={current.url} controls autoPlay className="max-w-full max-h-[75vh] rounded-lg bg-black" onError={() => setVideoError(true)} />
          )
        ) : (
          <img src={current.url} alt={current.label ?? ''} className="max-w-full max-h-[75vh] rounded-lg object-contain" />
        )}
        {current.label && <p className="text-white/70 text-xs">{current.label}</p>}

        {items.length > 1 && (
          <div className="flex gap-1.5 mt-1">
            {items.map((_, i) => (
              <button
                key={i}
                onClick={e => { e.stopPropagation(); onIndexChange(i); }}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${i === index ? 'bg-white' : 'bg-white/30'}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
