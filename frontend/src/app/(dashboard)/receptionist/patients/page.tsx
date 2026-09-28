'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/shared/page-header';
import { Pagination } from '@/components/shared/pagination';
import { usePatients } from '@/hooks/use-patients';
import type { Gender } from '@/types/patients';

const genderLabel: Record<Gender, string> = { MALE: 'Nam', FEMALE: 'Nữ', OTHER: 'Khác' };

export default function ReceptionistPatientsPage() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const query = useMemo(() => ({ page, limit: 20, search: search || undefined }), [page, search]);
  const hasSearched = search.length > 0;
  const { data, isLoading, error } = usePatients(query, hasSearched);

  const patients = data?.items ?? [];

  return (
    <main className="min-h-full bg-background">
      <PageHeader
        title="Hồ sơ bệnh nhân"
        description="Tạo, tra cứu và cập nhật thông tin hành chính của bệnh nhân"
        action={
          <Link href="/receptionist/patients/new">
            <Button>
              <Plus className="h-4 w-4" /> Tạo hồ sơ
            </Button>
          </Link>
        }
      />

      <section className="space-y-4 p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <form
            className="flex w-full gap-2 md:max-w-xl"
            onSubmit={(e) => {
              e.preventDefault();
              setPage(1);
              setSearch(searchInput.trim());
            }}
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Tìm theo mã BN, họ tên, email hoặc SĐT"
              />
            </div>
            <Button type="submit" variant="secondary">
              <Search className="h-4 w-4" /> Tìm
            </Button>
          </form>
          <Badge variant="muted">{data?.meta.total ?? patients.length} hồ sơ</Badge>
        </div>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] border-collapse text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="h-10 px-4 font-semibold">Mã BN</th>
                  <th className="h-10 px-4 font-semibold">Họ tên</th>
                  <th className="h-10 px-4 font-semibold">Email</th>
                  <th className="h-10 px-4 font-semibold">Số điện thoại</th>
                  <th className="h-10 px-4 font-semibold">Giới tính</th>
                  <th className="h-10 px-4 font-semibold">Nhắc lịch</th>
                  <th className="h-10 px-4 font-semibold text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {!hasSearched && (
                  <tr>
                    <td colSpan={7} className="h-14 px-4 text-muted-foreground">
                      Nhập từ khoá và nhấn Tìm để tra cứu hồ sơ bệnh nhân.
                    </td>
                  </tr>
                )}
                {hasSearched && isLoading && (
                  <tr>
                    <td colSpan={7} className="h-14 px-4 text-muted-foreground">
                      Đang tải hồ sơ...
                    </td>
                  </tr>
                )}
                {hasSearched && error && (
                  <tr>
                    <td colSpan={7} className="h-14 px-4 text-destructive">
                      {error.message}
                    </td>
                  </tr>
                )}
                {hasSearched && !isLoading && !error && patients.length === 0 && (
                  <tr>
                    <td colSpan={7} className="h-14 px-4 text-muted-foreground">
                      Chưa có hồ sơ phù hợp.
                    </td>
                  </tr>
                )}
                {hasSearched &&
                  patients.map((p) => (
                    <tr key={p.id} className="border-t border-border bg-white hover:bg-muted/30 transition-colors">
                      <td className="h-12 px-4 font-mono text-xs font-medium">{p.patientCode}</td>
                      <td className="h-12 px-4 font-medium">{p.fullName}</td>
                      <td className="h-12 px-4 text-muted-foreground">{p.email ?? '—'}</td>
                      <td className="h-12 px-4">{p.phone}</td>
                      <td className="h-12 px-4">{genderLabel[p.gender]}</td>
                      <td className="h-12 px-4">
                        <Badge variant={p.notificationConsent ? 'success' : 'muted'}>
                          {p.notificationConsent ? 'Có' : 'Không'}
                        </Badge>
                      </td>
                      <td className="h-12 px-4">
                        <div className="flex justify-end gap-1">
                          <Link
                            href={`/receptionist/patients/${p.id}`}
                            className="inline-flex items-center rounded-md border border-border bg-muted px-3 py-1 text-xs font-medium text-foreground transition hover:bg-muted/80"
                          >
                            Chi tiết
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Card>

        {hasSearched && data?.meta && (
          <Pagination page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} onPageChange={setPage} />
        )}
      </section>
    </main>
  );
}
