import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export interface TabItem {
  id: string;
  label: string;
  // Optional — when provided, Tabs renders the active tab's content itself.
  // Omit it if the caller prefers to render content separately (e.g. it
  // needs to sit outside the wrapping <div>, or is conditionally rendered
  // among other page content).
  content?: ReactNode;
}

interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onTabChange: (id: string) => void;
  className?: string;
}

// Controlled tabs primitive — the parent owns `activeTab` state (no internal
// state here), matching the rest of components/ui/*. Renders the tab button
// row; if a tab's `content` is set, also renders it below the row for
// whichever tab is active.
export function Tabs({ tabs, activeTab, onTabChange, className }: TabsProps) {
  const active = tabs.find((tab) => tab.id === activeTab);

  return (
    <div className={className}>
      <div role="tablist" className="inline-flex flex-wrap gap-1 rounded-md bg-muted p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            onClick={() => onTabChange(tab.id)}
            aria-selected={tab.id === activeTab}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium outline-none transition-colors',
              'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              tab.id === activeTab
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {active?.content != null && <div className="mt-4">{active.content}</div>}
    </div>
  );
}
