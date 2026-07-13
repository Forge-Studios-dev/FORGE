import { useId, type InputHTMLAttributes } from 'react';

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  /** Error message. When set, wires aria-invalid + aria-describedby and renders the message (LOW-09). */
  error?: string;
};

export function Input({ className = '', error, id, 'aria-describedby': ariaDescribedBy, ...props }: InputProps) {
  const generatedId = useId();
  const errorId = error ? `${id ?? generatedId}-error` : undefined;

  return (
    <div className="w-full">
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={[ariaDescribedBy, errorId].filter(Boolean).join(' ') || undefined}
        className={`w-full rounded-lg border bg-surface-container-low px-4 py-2.5 text-on-surface placeholder:text-outline focus:outline-none focus:ring-1 ${
          error ? 'border-error focus:border-error focus:ring-error' : 'border-subtle focus:border-primary focus:ring-primary'
        } ${className}`}
        {...props}
      />
      {error ? (
        <p id={errorId} className="mt-1 text-xs text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
