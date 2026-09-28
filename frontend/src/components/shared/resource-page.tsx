import { Plus, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PageHeader } from './page-header';

interface ResourcePageProps {
  title: string;
  description: string;
  primaryAction?: string;
  columns: string[];
  rows: Array<Record<string, string>>;
}

export function ResourcePage({ title, description, primaryAction, columns, rows }: ResourcePageProps) {
  return (
    <div className="min-h-full bg-background">
      <PageHeader
        title={title}
        description={description}
        action={
          primaryAction ? (
            <Button>
              <Plus className="h-4 w-4" />
              {primaryAction}
            </Button>
          ) : null
        }
      />
      <section className="space-y-4 p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Tìm kiếm" />
          </div>
          <Badge variant="muted">{rows.length} bản ghi</Badge>
        </div>
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  {columns.map((column) => (
                    <th key={column} className="h-10 px-4 font-semibold">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={index} className="border-t border-border bg-white">
                    {columns.map((column) => (
                      <td key={column} className="h-12 px-4">
                        {row[column] ?? '-'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>
    </div>
  );
}
