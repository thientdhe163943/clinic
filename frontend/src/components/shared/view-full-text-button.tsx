'use client';

import { useState } from 'react';
import { Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';

interface ViewFullTextButtonProps {
  label: string;
  text: string;
}

// Read-only counterpart to ExpandableTextInput — for table cells that
// truncate long description/note text (`truncate`/fixed-width columns),
// an eye button opens a Dialog showing the full, untruncated text.
export function ViewFullTextButton({ label, text }: ViewFullTextButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Xem đầy đủ ${label}`}
        title={`Xem đầy đủ ${label}`}
        className="inline-flex shrink-0 items-center text-muted-foreground hover:text-foreground"
      >
        <Eye className="h-3.5 w-3.5" />
      </button>

      <Dialog open={open} onClose={() => setOpen(false)} title={label} className="max-w-lg">
        <p className="whitespace-pre-wrap text-sm text-foreground">{text}</p>
      </Dialog>
    </>
  );
}
