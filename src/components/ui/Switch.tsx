interface SwitchProps {
  checked: boolean;
  onChange: () => void;
  size?: 'sm' | 'md';
  disabled?: boolean;
  label?: string;
}

const SIZES = {
  sm: { track: 'h-5 w-9', knob: 'h-4 w-4', on: 'translate-x-4', off: 'translate-x-0.5' },
  md: { track: 'h-6 w-11', knob: 'h-5 w-5', on: 'translate-x-5', off: 'translate-x-0.5' },
};

export default function Switch({ checked, onChange, size = 'md', disabled, label }: SwitchProps) {
  const s = SIZES[size];
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={`relative inline-flex flex-shrink-0 items-center rounded-full transition-colors duration-200 ease-in-out
        ${s.track} ${checked ? 'bg-primary' : 'bg-gray-300'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`inline-block transform rounded-full bg-white shadow ring-0 transition-transform duration-200 ease-in-out
          ${s.knob} ${checked ? s.on : s.off}`}
      />
    </button>
  );
}
