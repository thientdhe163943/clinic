import { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: 'teal' | 'blue' | 'amber' | 'red';
}

const toneClass = {
  teal: 'bg-teal-50 text-teal-700',
  blue: 'bg-sky-50 text-sky-700',
  amber: 'bg-amber-50 text-amber-700',
  red: 'bg-red-50 text-red-700',
};

export function StatCard({ label, value, icon: Icon, tone = 'teal' }: StatCardProps) {
  return (
    <Card className="flex min-h-24 items-center justify-between p-4">
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-2 text-2xl font-semibold">{value}</p>
      </div>
      <div className={`flex h-10 w-10 items-center justify-center rounded-md ${toneClass[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
    </Card>
  );
}
