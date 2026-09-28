'use client';

import { useState } from 'react';
import { Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

interface ExpandableTextInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}

// Compact single-line Input for the form's normal layout, plus an "eye"
// button that opens a Dialog with a full-size textarea bound to the same
// value — for description/note-style fields that can run long (contraindications,
// clinical notes...) without permanently growing every form that has one.
export function ExpandableTextInput({
  label,
  value,
  onChange,
  placeholder,
  rows = 6,
}: ExpandableTextInputProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);

  function openDialog() {
    setDraft(value);
    setOpen(true);
  }

  function save() {
    onChange(draft);
    setOpen(false);
  }

  return (
    <>
      <label className="mb-1.5 block text-sm font-medium text-foreground">{label}</label>
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1"
        />
        <Button
          type="button"
          variant="secondary"
          size="icon"
          onClick={openDialog}
          aria-label={`Xem đầy đủ ${label}`}
          title={`Xem đầy đủ ${label}`}
        >
          <Eye className="h-4 w-4" />
        </Button>
      </div>

      <Dialog open={open} onClose={() => setOpen(false)} title={label} className="max-w-lg">
        <div className="space-y-4">
          <textarea
            rows={rows}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={placeholder}
            className="w-full resize-y rounded-md border border-input bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/20"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Hủy
            </Button>
            <Button type="button" onClick={save}>
              Lưu
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
