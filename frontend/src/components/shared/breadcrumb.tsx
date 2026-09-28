import { ChevronRight, Home } from 'lucide-react';
import Link from 'next/link';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <div className="border-b border-border bg-secondary/40">
      <nav
        aria-label="Breadcrumb"
        className="mx-auto flex max-w-6xl flex-wrap items-center gap-1.5 px-5 py-3 text-xs text-muted-foreground sm:text-sm"
      >
        <Link href="/clinic" className="flex items-center gap-1 hover:text-primary">
          <Home className="h-3.5 w-3.5" />
          Trang chủ
        </Link>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <span key={`${item.label}-${index}`} className="flex items-center gap-1.5">
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />
              {item.href && !isLast ? (
                <Link href={item.href} className="hover:text-primary">
                  {item.label}
                </Link>
              ) : (
                <span className={isLast ? 'font-medium text-foreground' : undefined}>{item.label}</span>
              )}
            </span>
          );
        })}
      </nav>
    </div>
  );
}
