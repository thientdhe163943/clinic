interface FieldProps {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}

export function Field({ id, label, required, error, children }: FieldProps) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </label>
      <div className={error ? 'rounded-md ring-1 ring-destructive' : undefined}>{children}</div>
      {error && (
        <p className="flex items-center gap-1 text-sm font-medium text-destructive">
          <span>⚠</span> {error}
        </p>
      )}
    </div>
  );
}
