'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export interface FaqItem {
  question: string;
  answer: string;
}

export function FaqAccordion({ items, defaultOpenIndex = 0 }: { items: FaqItem[]; defaultOpenIndex?: number | null }) {
  const [openIndex, setOpenIndex] = useState<number | null>(defaultOpenIndex);

  return (
    <div className="divide-y divide-border rounded-lg border border-border bg-white">
      {items.map((item, index) => (
        <div key={item.question}>
          <button
            type="button"
            onClick={() => setOpenIndex(openIndex === index ? null : index)}
            className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left text-sm font-medium text-foreground"
          >
            {item.question}
            <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${openIndex === index ? 'rotate-180' : ''}`} />
          </button>
          {openIndex === index && <p className="px-4 pb-4 text-sm leading-6 text-muted-foreground">{item.answer}</p>}
        </div>
      ))}
    </div>
  );
}
