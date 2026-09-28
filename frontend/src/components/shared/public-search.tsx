'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { Loader2, Search, Stethoscope, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePublicDoctors } from '@/hooks/use-public-doctors';
import { usePublicServices } from '@/hooks/use-public-services';

const MAX_RESULTS = 4;

export function PublicSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const searchEnabled = open && debounced.length >= 2;
  const { data: doctors, isFetching: doctorsLoading } = usePublicDoctors(
    { search: debounced || undefined },
    searchEnabled,
  );
  const { data: services, isFetching: servicesLoading } = usePublicServices(
    { search: debounced || undefined },
    searchEnabled,
  );

  function closeAndReset() {
    setOpen(false);
    setQuery('');
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    router.push(`/clinic/doctors?q=${encodeURIComponent(trimmed)}`);
    closeAndReset();
  }

  const hasResults = Boolean(doctors?.length || services?.length);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Tìm kiếm"
        className="flex h-10 w-10 items-center justify-center rounded-md border border-border text-foreground transition-colors hover:bg-secondary"
      >
        <Search className="h-4 w-4" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={closeAndReset} />
          <div className="absolute right-0 top-12 z-50 w-[92vw] max-w-md rounded-lg border border-border bg-white p-4 shadow-xl">
            <form onSubmit={handleSubmit} className="flex items-center gap-2 rounded-md border border-input px-3">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm bác sĩ, dịch vụ, chuyên khoa..."
                className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              {(doctorsLoading || servicesLoading) && (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
              )}
              <button
                type="button"
                onClick={closeAndReset}
                aria-label="Đóng tìm kiếm"
                className="shrink-0 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </form>

            {debounced.length >= 2 && (
              <div className="mt-3 max-h-80 space-y-4 overflow-y-auto border-t border-border pt-3">
                {!hasResults && !doctorsLoading && !servicesLoading ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">Không tìm thấy kết quả phù hợp.</p>
                ) : (
                  <>
                    {Boolean(doctors?.length) && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Bác sĩ
                        </p>
                        <ul className="mt-2 space-y-1">
                          {doctors!.slice(0, MAX_RESULTS).map((doctor) => (
                            <li key={doctor.id}>
                              <Link
                                href={`/clinic/doctors/${doctor.id}`}
                                onClick={closeAndReset}
                                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-secondary"
                              >
                                <Stethoscope className="h-3.5 w-3.5 shrink-0 text-primary" />
                                <span className="font-medium text-foreground">{doctor.fullName}</span>
                                {doctor.specialtyName && (
                                  <span className="truncate text-xs text-muted-foreground">
                                    — {doctor.specialtyName}
                                  </span>
                                )}
                              </Link>
                            </li>
                          ))}
                        </ul>
                        <Link
                          href={`/clinic/doctors?q=${encodeURIComponent(debounced)}`}
                          onClick={closeAndReset}
                          className="mt-1 inline-block px-2 text-xs font-medium text-primary hover:underline"
                        >
                          Xem tất cả bác sĩ phù hợp →
                        </Link>
                      </div>
                    )}

                    {Boolean(services?.length) && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Dịch vụ
                        </p>
                        <ul className="mt-2 space-y-1">
                          {services!.slice(0, MAX_RESULTS).map((service) => (
                            <li key={service.id}>
                              <Link
                                href={`/clinic/services/${service.id}`}
                                onClick={closeAndReset}
                                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-secondary"
                              >
                                <span className="font-medium text-foreground">{service.name}</span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                        <Link
                          href={`/clinic/services?q=${encodeURIComponent(debounced)}`}
                          onClick={closeAndReset}
                          className="mt-1 inline-block px-2 text-xs font-medium text-primary hover:underline"
                        >
                          Xem tất cả dịch vụ phù hợp →
                        </Link>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
