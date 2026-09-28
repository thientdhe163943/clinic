import type { LucideIcon } from 'lucide-react';

interface PatientPageHeaderProps {
  icon: LucideIcon;
  title: string;
  description?: string;
}

export function PatientPageHeader({ icon: Icon, title, description }: PatientPageHeaderProps) {
  return (
    <div className="mx-auto max-w-6xl px-5 pt-8 pb-4">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
      </div>
    </div>
  );
}
