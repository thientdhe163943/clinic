'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, FileText, Plus, Pencil, Printer, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ExpandableTextInput } from '@/components/shared/expandable-text-input';
import { Select } from '@/components/ui/select';
import { PageHeader } from '@/components/shared/page-header';
import { useClsOrderEvents } from '@/hooks/use-cls-order-events';
import {
  useVisits,
  useCompleteVisit,
  useHoldForResults,
  useClsOrders,
  useCreateClsOrder,
  useEditClsOrder,
  useCreateExaminationResult,
  useUpdateExaminationResult,
  useVisitResult,
  useVitalSigns,
  useUpsertVitalSigns,
} from '@/hooks/use-visits';
import { usePrescription, useCreatePrescription, useUpdatePrescription, useMedicines } from '@/hooks/use-prescriptions';
import { useRooms } from '@/hooks/use-rooms';
import { useServiceList } from '@/hooks/use-services';
import { useMedicalRecord } from '@/hooks/use-medical-records';
import { clsOrdersApi, visitsApi } from '@/lib/api/endpoints/visits';
import { VisitResultPrintView } from '@/components/shared/visit-result-print-view';
import { PrescriptionPrintView } from '@/components/shared/prescription-print-view';
import { ClsOrdersPrintView } from '@/components/shared/cls-orders-print-view';
import { formatAppointmentDateTime } from '@/lib/utils/appointment-datetime';
import type { ClsOrder, ClsOrderStatus, VisitListItem, VisitStatus } from '@/types/visits';
import type { Medicine, CreatePrescriptionItemRequest } from '@/types/visits';
import type { ClsRoomCategory, Room } from '@/types/rooms';
import type { Service } from '@/types/services';

const visitStatusLabel: Record<VisitStatus, string> = {
  WAITING: 'Đang chờ',
  CALLED: 'Đã gọi',
  IN_PROGRESS: 'Đang khám',
  AWAITING_RESULTS: 'Chờ kết quả CLS',
  COMPLETED: 'Hoàn tất',
  NO_SHOW: 'Vắng mặt',
  CANCELLED: 'Đã hủy',
};
const visitStatusVariant: Record<VisitStatus, 'warning' | 'default' | 'success' | 'muted' | 'danger'> = {
  WAITING: 'warning',
  CALLED: 'default',
  IN_PROGRESS: 'default',
  AWAITING_RESULTS: 'muted',
  COMPLETED: 'success',
  NO_SHOW: 'danger',
  CANCELLED: 'danger',
};

const clsStatusLabel: Record<ClsOrderStatus, string> = {
  PENDING: 'Chờ thực hiện',
  IN_PROGRESS: 'Đang thực hiện',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
};
const clsStatusVariant: Record<ClsOrderStatus, 'muted' | 'warning' | 'success' | 'danger'> = {
  PENDING: 'muted',
  IN_PROGRESS: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'danger',
};

const clsCategoryLabel: Record<ClsRoomCategory, string> = {
  LAB: 'Xét nghiệm',
  XRAY: 'X-quang',
  ULTRASOUND: 'Siêu âm',
  ECG: 'Chụp điện tim',
};

// Groups active CLS rooms by specialty so the doctor can quickly find the
// right room (Xét nghiệm/X-quang/Siêu âm) instead of one flat alphabetical
// list — rooms predating this categorization (clsCategory unset) fall back
// to a single "Khác" group rather than being hidden.
function groupClsRoomsByCategory(rooms: Room[]): { label: string; rooms: Room[] }[] {
  const groups = new Map<string, Room[]>();
  for (const room of rooms) {
    const label = room.clsCategory ? clsCategoryLabel[room.clsCategory] : 'Khác';
    const bucket = groups.get(label) ?? [];
    bucket.push(room);
    groups.set(label, bucket);
  }
  return Array.from(groups.entries()).map(([label, rooms]) => ({ label, rooms }));
}

function fmt(value: string | null | undefined) {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
}
function fmtDate(value: string | null | undefined) {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString('vi-VN');
}

function formatServicePrice(price: number): string {
  return `${price.toLocaleString('vi-VN')}đ`;
}

// ─── Create CLS Inline Form ──────────────────────────────────────────────────

function CreateClsInlineForm({
  visitId,
  existingOrders,
  onClose,
}: {
  visitId: string;
  existingOrders: ClsOrder[];
  onClose: () => void;
}) {
  const { data: allRooms = [] } = useRooms();
  const clsRooms = allRooms.filter((r) => r.type === 'CLS' && r.status === 'ACTIVE');

  const [serviceSearch, setServiceSearch] = useState('');
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  const [roomByCategory, setRoomByCategory] = useState<Partial<Record<ClsRoomCategory, string>>>({});
  const [noteByCategory, setNoteByCategory] = useState<Partial<Record<ClsRoomCategory, string>>>({});
  const [noteOpenByCategory, setNoteOpenByCategory] = useState<Partial<Record<ClsRoomCategory, boolean>>>({});
  const [localPending, setLocalPending] = useState(false);

  const { data: servicesData } = useServiceList({
    type: 'CLS',
    search: serviceSearch || undefined,
    limit: 50,
  });
  const searchResults = (servicesData?.items ?? []).filter((s) => s.clsCategory != null);

  const activeOrderServiceIds = new Set(
    existingOrders
      .filter((o) => o.status !== 'CANCELLED')
      .map((o) => o.serviceId)
  );

  const uniqueCategories = Array.from(new Set(selectedServices.map((s) => s.clsCategory!)));

  function toggleService(service: Service) {
    const isSelected = selectedServices.some((s) => s.id === service.id);
    if (isSelected) {
      setSelectedServices((prev) => prev.filter((s) => s.id !== service.id));
    } else {
      setSelectedServices((prev) => [...prev, service]);
      // Auto-assign room when this category has exactly 1 active room
      if (service.clsCategory && !roomByCategory[service.clsCategory]) {
        const catRooms = clsRooms.filter((r) => r.clsCategory === service.clsCategory);
        if (catRooms.length === 1) {
          setRoomByCategory((prev) => ({ ...prev, [service.clsCategory!]: catRooms[0].id }));
        }
      }
    }
  }

  const createClsOrder = useCreateClsOrder();

  async function handleSubmit() {
    const allAssigned = uniqueCategories.every((cat) => roomByCategory[cat]);
    if (!selectedServices.length || !allAssigned || localPending) return;
    setLocalPending(true);
    try {
      for (const service of selectedServices) {
        await createClsOrder.mutateAsync({
          visitId,
          clsRoomId: roomByCategory[service.clsCategory!]!,
          serviceId: service.id,
          note: noteByCategory[service.clsCategory!] || undefined,
        });
      }
      onClose();
    } catch {
      // toast already shown by mutation's onError
    } finally {
      setLocalPending(false);
    }
  }

  const allAssigned = uniqueCategories.every((cat) => roomByCategory[cat]);
  const canSubmit = selectedServices.length > 0 && allAssigned && !localPending;

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">Tạo phiếu CLS</p>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          ✕
        </button>
      </div>

      {/* Chọn dịch vụ */}
      <div className="mb-4">
        <label className="mb-1 block text-sm font-medium">Dịch vụ CLS *</label>
        {selectedServices.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {selectedServices.map((s) => (
              <span
                key={s.id}
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
              >
                {s.name}
                <button
                  type="button"
                  onClick={() => toggleService(s)}
                  className="ml-0.5 text-primary/60 hover:text-primary"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}
        <Input
          value={serviceSearch}
          onChange={(e) => setServiceSearch(e.target.value)}
          placeholder="Tìm theo tên dịch vụ..."
          className="mb-2"
        />
        {serviceSearch && (
        <div className="max-h-44 overflow-y-auto rounded-md border border-border">
          {searchResults.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">Không tìm thấy dịch vụ</p>
          ) : (
            searchResults.map((s) => {
              const checked = selectedServices.some((sel) => sel.id === s.id);
              const alreadyOrdered = activeOrderServiceIds.has(s.id);
              return (
                <label
                  key={s.id}
                  className={`flex items-center gap-2.5 px-3 py-2 text-sm ${alreadyOrdered ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-muted'} ${checked ? 'bg-primary/5' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={alreadyOrdered}
                    onChange={() => !alreadyOrdered && toggleService(s)}
                    className="shrink-0 accent-primary"
                  />
                  <span className="flex-1">{s.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {alreadyOrdered ? 'Đã chỉ định · ' : ''}{clsCategoryLabel[s.clsCategory!]} · {formatServicePrice(s.price)}
                  </span>
                </label>
              );
            })
          )}
        </div>
        )}
      </div>

      {/* Xác nhận phòng theo nhóm category */}
      {uniqueCategories.length > 0 && (
        <div className="mb-4 rounded-md border border-border p-3">
          <p className="mb-2 text-sm font-medium">Xác nhận phòng thực hiện</p>
          <div className="flex flex-col gap-2">
            {uniqueCategories.map((cat) => {
              const catRooms = clsRooms.filter((r) => r.clsCategory === cat);
              const catCount = selectedServices.filter((s) => s.clsCategory === cat).length;
              const noteOpen = !!noteOpenByCategory[cat];
              return (
                <div key={cat} className="flex flex-col gap-1">
                  <div className="flex items-center gap-3">
                    <div className="w-36 shrink-0">
                      <p className="text-xs font-medium">{clsCategoryLabel[cat]}</p>
                      <p className="text-xs text-muted-foreground">{catCount} dịch vụ</p>
                    </div>
                    <Select
                      value={roomByCategory[cat] ?? ''}
                      onChange={(e) =>
                        setRoomByCategory((prev) => ({ ...prev, [cat]: e.target.value }))
                      }
                      className="flex-1"
                    >
                      <option value="">-- Chọn phòng --</option>
                      {catRooms.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </Select>
                    <button
                      type="button"
                      onClick={() =>
                        setNoteOpenByCategory((prev) => ({ ...prev, [cat]: !prev[cat] }))
                      }
                      className={`shrink-0 rounded px-2 py-1 text-xs font-medium transition-colors ${
                        noteOpen || noteByCategory[cat]
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      {noteOpen ? '− Ghi chú' : '+ Ghi chú'}
                    </button>
                  </div>
                  {noteOpen && (
                    <textarea
                      value={noteByCategory[cat] ?? ''}
                      onChange={(e) =>
                        setNoteByCategory((prev) => ({ ...prev, [cat]: e.target.value }))
                      }
                      placeholder="Ghi chú cho phiếu này..."
                      rows={2}
                      className="ml-[156px] w-[calc(100%-156px)] resize-none rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-3 flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onClose}>
          Hủy
        </Button>
        <Button size="sm" onClick={handleSubmit} disabled={!canSubmit}>
          {localPending
            ? 'Đang lưu...'
            : selectedServices.length > 1
              ? `Tạo ${selectedServices.length} phiếu`
              : 'Tạo phiếu'}
        </Button>
      </div>
    </Card>
  );
}

// ─── Edit CLS Inline Form ────────────────────────────────────────────────────

function ClsResultView({ order }: { order: ClsOrder }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Kết quả — {order.serviceName}
      </p>

      {/* LAB: structured table */}
      {order.resultRows && order.resultRows.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-muted-foreground">
                <th className="px-3 py-2 font-medium">Tên xét nghiệm</th>
                <th className="px-3 py-2 font-medium">Kết quả</th>
                <th className="px-3 py-2 font-medium">Đơn vị</th>
                <th className="px-3 py-2 font-medium">Bình thường</th>
                <th className="px-3 py-2 font-medium">Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {order.resultRows.map((row, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 font-medium">{row.name}</td>
                  <td className="px-3 py-2">{row.result}</td>
                  <td className="px-3 py-2 text-muted-foreground">{row.unit ?? '—'}</td>
                  <td className="px-3 py-2 text-muted-foreground">{row.normalRange ?? '—'}</td>
                  <td className="px-3 py-2 text-muted-foreground">{row.note ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* XRAY/ULTRASOUND: findings text */}
      {order.resultFindings && (
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Kết quả</p>
          <p className="rounded-md border border-border px-3 py-2 text-sm whitespace-pre-wrap">{order.resultFindings}</p>
        </div>
      )}

      {/* Kết luận */}
      {order.resultSummary && (
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Kết luận</p>
          <p className="rounded-md border border-border px-3 py-2 text-sm font-medium whitespace-pre-wrap">{order.resultSummary}</p>
        </div>
      )}

      {!order.resultRows && !order.resultFindings && !order.resultSummary && (
        <p className="text-sm text-muted-foreground">Chưa có nội dung kết quả.</p>
      )}
    </div>
  );
}

function EditClsInlineForm({
  visitId,
  order,
  existingOrders,
  onClose,
}: {
  visitId: string;
  order: ClsOrder;
  existingOrders: ClsOrder[];
  onClose: () => void;
}) {
  const { data: allRooms = [] } = useRooms();
  const clsRooms = allRooms.filter((r) => r.type === 'CLS' && r.status === 'ACTIVE');

  const [serviceInput, setServiceInput] = useState(order.serviceName);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [clsRoomId, setClsRoomId] = useState(order.clsRoomId);
  const [note, setNote] = useState(order.note ?? '');

  // Services already ordered (excluding this order itself and cancelled ones)
  const takenServiceIds = useMemo(
    () => new Set(
      existingOrders
        .filter((o) => o.id !== order.id && o.status !== 'CANCELLED')
        .map((o) => o.serviceId),
    ),
    [existingOrders, order.id],
  );

  // Show results only when user has typed something different from the current displayed name
  const currentDisplayName = selectedService?.name ?? order.serviceName;
  const showResults = serviceInput.length > 0 && serviceInput !== currentDisplayName;

  const { data: servicesData } = useServiceList({
    type: 'CLS',
    search: showResults ? serviceInput : undefined,
    limit: 50,
  });
  const searchResults = (servicesData?.items ?? []).filter(
    (s) => s.clsCategory != null && !takenServiceIds.has(s.id),
  );

  // Rooms filtered to the active service's category
  const activeCategory = selectedService?.clsCategory ?? order.clsRoomCategory;
  const categoryRooms = activeCategory
    ? clsRooms.filter((r) => r.clsCategory === activeCategory)
    : clsRooms;

  function handleSelectService(s: Service) {
    setSelectedService(s);
    setServiceInput(s.name);
    if (s.clsCategory) {
      const catRooms = clsRooms.filter((r) => r.clsCategory === s.clsCategory);
      if (catRooms.length === 1) setClsRoomId(catRooms[0].id);
      else setClsRoomId('');
    }
  }

  const editClsOrder = useEditClsOrder(visitId);

  const effectiveServiceId = selectedService?.id ?? order.serviceId;
  const canSubmit = !!clsRoomId && !!effectiveServiceId && !editClsOrder.isPending;

  function handleSubmit() {
    if (!canSubmit) return;
    editClsOrder.mutate(
      { id: order.id, clsRoomId, serviceId: effectiveServiceId, note: note || null },
      { onSuccess: () => onClose() },
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sửa phiếu CLS</p>

      {/* Dịch vụ */}
      <div>
        <label className="mb-1 block text-sm font-medium">Dịch vụ CLS *</label>
        <Input
          value={serviceInput}
          onChange={(e) => setServiceInput(e.target.value)}
          placeholder="Tên dịch vụ..."
          className="mb-1"
        />
        {showResults && (
          <div className="max-h-36 overflow-y-auto rounded-md border border-border">
            {searchResults.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">Không tìm thấy</p>
            ) : (
              searchResults.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleSelectService(s)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                >
                  <span className="flex-1">{s.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {clsCategoryLabel[s.clsCategory!]} · {formatServicePrice(s.price)}
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Phòng */}
      <div>
        <label className="mb-1 block text-sm font-medium">Phòng CLS *</label>
        <Select value={clsRoomId} onChange={(e) => setClsRoomId(e.target.value)}>
          <option value="">-- Chọn phòng --</option>
          {categoryRooms.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </Select>
      </div>

      <ExpandableTextInput label="Ghi chú" value={note} onChange={setNote} placeholder="Ghi chú (tuỳ chọn)" />

      <div className="flex justify-end gap-2">
        <Button size="sm" variant="secondary" onClick={onClose}>Hủy</Button>
        <Button size="sm" onClick={handleSubmit} disabled={!canSubmit}>
          {editClsOrder.isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
        </Button>
      </div>
    </div>
  );
}

// ─── CLS Tab ─────────────────────────────────────────────────────────────────

function ClsTab({
  visit,
  diagnosis,
  onDiagnosisChange,
}: {
  visit: VisitListItem;
  diagnosis: string;
  onDiagnosisChange: (v: string) => void;
}) {
  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [editTargetId, setEditTargetId] = useState<string | null>(null);
  const [resultTargetId, setResultTargetId] = useState<string | null>(null);
  const { data: orders = [] } = useClsOrders(visit.id);
  const holdForResults = useHoldForResults();
  const router = useRouter();

  return (
    <div className="flex flex-col gap-4">
      {/* Tạo phiếu CLS */}
      {visit.status === 'IN_PROGRESS' && (
        <div className="flex flex-col gap-3">
          {!showCreatePanel && (
            <div className="self-start">
              <Button onClick={() => { setShowCreatePanel(true); setEditTargetId(null); }}>
                <Plus className="h-4 w-4" /> Tạo phiếu CLS
              </Button>
            </div>
          )}
          {showCreatePanel && (
            <CreateClsInlineForm visitId={visit.id} existingOrders={orders} onClose={() => setShowCreatePanel(false)} />
          )}
        </div>
      )}

      {orders.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Chưa có phiếu CLS nào</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-muted-foreground">
                <th className="px-4 py-3 font-medium">Dịch vụ</th>
                <th className="px-4 py-3 font-medium">Phòng CLS</th>
                <th className="px-4 py-3 font-medium">Trạng thái</th>
                <th className="px-4 py-3 font-medium">Ghi chú</th>
                <th className="px-4 py-3 font-medium">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o: ClsOrder) => (
                <>
                  <tr key={o.id} className={`border-b border-border ${editTargetId === o.id ? '' : 'last:border-0'}`}>
                    <td className="px-4 py-3 font-medium">{o.serviceName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{o.clsRoomName}</td>
                    <td className="px-4 py-3">
                      <Badge variant={clsStatusVariant[o.status]}>{clsStatusLabel[o.status]}</Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{o.note ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {o.status === 'PENDING' && (
                          <Button
                            size="sm"
                            variant={editTargetId === o.id ? 'primary' : 'secondary'}
                            onClick={() => { setEditTargetId((prev) => prev === o.id ? null : o.id); setResultTargetId(null); setShowCreatePanel(false); }}
                          >
                            <Pencil className="h-3 w-3" /> Sửa
                          </Button>
                        )}
                        {o.status === 'COMPLETED' && (
                          <Button
                            size="sm"
                            variant={resultTargetId === o.id ? 'primary' : 'secondary'}
                            onClick={() => { setResultTargetId((prev) => prev === o.id ? null : o.id); setEditTargetId(null); }}
                          >
                            Xem kết quả
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {resultTargetId === o.id && o.status === 'COMPLETED' && (
                    <tr key={`${o.id}-result`} className="border-b border-border bg-muted/20 last:border-0">
                      <td colSpan={5} className="px-4 py-4">
                        <ClsResultView order={o} />
                      </td>
                    </tr>
                  )}
                  {editTargetId === o.id && (
                    <tr key={`${o.id}-edit`} className="border-b border-border bg-muted/30 last:border-0">
                      <td colSpan={5} className="px-4 py-4">
                        <EditClsInlineForm
                          visitId={visit.id}
                          order={o}
                          existingOrders={orders}
                          onClose={() => setEditTargetId(null)}
                        />
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Bottom action card — chỉ hiện khi có orders */}
      {orders.length > 0 && (
        <Card className="p-4">
          <div className="flex flex-col gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Chẩn đoán <span className="text-xs font-normal text-muted-foreground">(in trên phiếu CLS)</span>
              </label>
              <textarea
                value={diagnosis}
                onChange={(e) => onDiagnosisChange(e.target.value)}
                placeholder="Nhập chẩn đoán để in lên phiếu..."
                rows={2}
                className={TEXTAREA_CLS}
              />
            </div>
            <div className="flex justify-end gap-2">
              {visit.status === 'IN_PROGRESS' && (
                <Button
                  variant="secondary"
                  onClick={() => holdForResults.mutate(visit.id, {
                    onSuccess: () => router.push('/doctor/visits'),
                  })}
                  disabled={holdForResults.isPending}
                >
                  Tạm rời — chờ CLS
                </Button>
              )}
              <Button variant="secondary" onClick={() => window.print()}>
                <Printer className="h-4 w-4" /> In phiếu CLS
              </Button>
            </div>
          </div>
        </Card>
      )}

      <ClsOrdersPrintView orders={orders} diagnosis={diagnosis || undefined} />
    </div>
  );
}

// ─── Exam Result Tab ──────────────────────────────────────────────────────────

function defaultFollowUpDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 5);
  return d.toISOString().split('T')[0];
}

const TEXTAREA_CLS =
  'w-full rounded-md border border-input bg-white px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/20';

function ExamResultTab({ visit }: { visit: VisitListItem }) {
  const { data: result, isLoading } = useVisitResult(visit.id);
  const createResult = useCreateExaminationResult(visit.id);
  const updateResult = useUpdateExaminationResult(visit.id);

  const [diagnosis, setDiagnosis] = useState('');
  const [clinicalNote, setClinicalNote] = useState('');
  const [treatmentResult, setTreatmentResult] = useState('');
  const [followUpDate, setFollowUpDate] = useState(defaultFollowUpDate);

  const [editing, setEditing] = useState(false);
  const [editDiagnosis, setEditDiagnosis] = useState('');
  const [editClinicalNote, setEditClinicalNote] = useState('');
  const [editTreatmentResult, setEditTreatmentResult] = useState('');
  const [editFollowUpDate, setEditFollowUpDate] = useState('');

  function startEditing() {
    if (!result) return;
    setEditDiagnosis(result.diagnosis);
    setEditClinicalNote(result.clinicalNote ?? '');
    setEditTreatmentResult(result.treatmentResult ?? '');
    setEditFollowUpDate(result.followUpDate ? result.followUpDate.split('T')[0] : defaultFollowUpDate());
    setEditing(true);
  }

  if (isLoading) return <p className="py-6 text-center text-sm text-muted-foreground">Đang tải...</p>;

  if (result && editing) {
    return (
      <Card className="p-5">
        <p className="mb-4 text-sm font-semibold text-foreground">Sửa kết quả khám</p>
        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Chẩn đoán <span className="text-destructive">*</span>
            </label>
            <textarea
              value={editDiagnosis}
              onChange={(e) => setEditDiagnosis(e.target.value)}
              placeholder="Nhập chẩn đoán..."
              rows={3}
              className={TEXTAREA_CLS}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Ghi chú lâm sàng</label>
            <textarea
              value={editClinicalNote}
              onChange={(e) => setEditClinicalNote(e.target.value)}
              placeholder="Triệu chứng, diễn biến bệnh... (tuỳ chọn)"
              rows={4}
              className={TEXTAREA_CLS}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Kết quả điều trị</label>
              <textarea
                value={editTreatmentResult}
                onChange={(e) => setEditTreatmentResult(e.target.value)}
                placeholder="Kết quả sau điều trị... (tuỳ chọn)"
                rows={3}
                className={TEXTAREA_CLS}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Ngày tái khám</label>
              <Input type="date" value={editFollowUpDate} onChange={(e) => setEditFollowUpDate(e.target.value)} />
              <p className="mt-1 text-xs text-muted-foreground">Mặc định sau 5 ngày kể từ hôm nay</p>
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <Button variant="secondary" onClick={() => setEditing(false)}>Hủy</Button>
            <Button
              onClick={() =>
                updateResult.mutate(
                  {
                    diagnosis: editDiagnosis,
                    clinicalNote: editClinicalNote || undefined,
                    treatmentResult: editTreatmentResult || undefined,
                    followUpDate: editFollowUpDate || undefined,
                  },
                  { onSuccess: () => setEditing(false) },
                )
              }
              disabled={!editDiagnosis || updateResult.isPending}
            >
              {updateResult.isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  if (result) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex justify-end gap-2">
          {visit.status !== 'COMPLETED' && (
            <Button variant="secondary" onClick={startEditing}>
              <Pencil className="h-4 w-4" /> Sửa kết quả
            </Button>
          )}
          <Button variant="secondary" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> In phiếu kết quả
          </Button>
        </div>
        <Card className="p-5">
          <div className="grid gap-3 text-sm md:grid-cols-2">
            <Field label="Chẩn đoán" value={result.diagnosis} />
            <Field label="Mã tra cứu" value={result.accessCode} />
            {result.clinicalNote && <Field label="Ghi chú lâm sàng" value={result.clinicalNote} />}
            {result.treatmentResult && <Field label="Kết quả điều trị" value={result.treatmentResult} />}
            {result.followUpDate && <Field label="Ngày tái khám" value={fmtDate(result.followUpDate)} />}
          </div>
          {result.clsSummaries.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-sm font-medium">Kết quả CLS</p>
              <ul className="flex flex-col gap-1 text-sm">
                {result.clsSummaries.map((s, i) => (
                  <li key={i} className="text-muted-foreground">
                    <span className="font-medium text-foreground">{s.serviceName}:</span>{' '}
                    {s.summary ?? 'Chưa có kết quả'}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
        <VisitResultPrintView data={result} />
      </div>
    );
  }

  if (visit.status !== 'IN_PROGRESS') {
    return <p className="py-6 text-center text-sm text-muted-foreground">Chưa có kết quả khám</p>;
  }

  return (
    <Card className="p-5">
      <div className="flex flex-col gap-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium">
            Chẩn đoán <span className="text-destructive">*</span>
          </label>
          <textarea
            value={diagnosis}
            onChange={(e) => setDiagnosis(e.target.value)}
            rows={3}
            className={TEXTAREA_CLS}
            placeholder="Nhập chẩn đoán..."
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">Ghi chú lâm sàng</label>
          <textarea
            value={clinicalNote}
            onChange={(e) => setClinicalNote(e.target.value)}
            placeholder="Triệu chứng, diễn biến bệnh... (tuỳ chọn)"
            rows={4}
            className={TEXTAREA_CLS}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Kết quả điều trị</label>
            <textarea
              value={treatmentResult}
              onChange={(e) => setTreatmentResult(e.target.value)}
              placeholder="Kết quả sau điều trị... (tuỳ chọn)"
              rows={3}
              className={TEXTAREA_CLS}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Ngày tái khám</label>
            <Input
              type="date"
              value={followUpDate}
              onChange={(e) => setFollowUpDate(e.target.value)}
            />
            <p className="mt-1 text-xs text-muted-foreground">Mặc định sau 5 ngày kể từ hôm nay</p>
          </div>
        </div>
        <div className="flex justify-end border-t border-border pt-3">
          <Button
            onClick={() =>
              createResult.mutate({
                diagnosis,
                clinicalNote: clinicalNote || undefined,
                treatmentResult: treatmentResult || undefined,
                followUpDate: followUpDate || undefined,
              })
            }
            disabled={!diagnosis || createResult.isPending}
          >
            {createResult.isPending ? 'Đang lưu...' : 'Lưu kết quả khám'}
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ─── Prescription Tab ─────────────────────────────────────────────────────────

interface PrescriptionRow extends CreatePrescriptionItemRequest {
  medicineName: string;
  unit: string;
}

function PrescriptionTab({ visit }: { visit: VisitListItem }) {
  const { data: prescription, isLoading } = usePrescription(visit.id);
  const { data: medicines = [] } = useMedicines();
  const createPrescription = useCreatePrescription();
  const updatePrescription = useUpdatePrescription(visit.id);

  const [isEditing, setIsEditing] = useState(false);
  const [note, setNote] = useState('');
  const [items, setItems] = useState<PrescriptionRow[]>([]);
  const [search, setSearch] = useState('');

  const filtered = useMemo(
    () =>
      search
        ? medicines.filter(
            (m: Medicine) =>
              m.name.toLowerCase().includes(search.toLowerCase()) ||
              m.activeIngredient.toLowerCase().includes(search.toLowerCase()),
          )
        : medicines,
    [medicines, search],
  );

  function startEditing() {
    if (!prescription) return;
    setNote(prescription.note ?? '');
    setItems(
      prescription.items.map((item) => ({
        medicineId: item.medicineId,
        medicineName: item.medicineName,
        unit: '',
        dosage: item.dosage,
        frequency: item.frequency,
        durationDays: item.durationDays,
        instruction: item.instruction ?? '',
      })),
    );
    setIsEditing(true);
  }

  function addMedicine(med: Medicine) {
    if (items.some((i) => i.medicineId === med.id)) return;
    setItems((prev) => [
      ...prev,
      {
        medicineId: med.id,
        medicineName: med.name,
        unit: med.unit,
        dosage: '',
        frequency: '',
        durationDays: 1,
        instruction: '',
      },
    ]);
    setSearch('');
  }

  function updateItem(idx: number, patch: Partial<PrescriptionRow>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleSave() {
    const itemsPayload = items.map(({ medicineId, dosage, frequency, durationDays, instruction }) => ({
      medicineId,
      dosage,
      frequency,
      durationDays,
      instruction: instruction || undefined,
    }));

    if (prescription && isEditing) {
      updatePrescription.mutate(
        { id: prescription.id, data: { note: note || undefined, items: itemsPayload } },
        { onSuccess: () => setIsEditing(false) },
      );
    } else {
      createPrescription.mutate({ visitId: visit.id, note: note || undefined, items: itemsPayload });
    }
  }

  if (isLoading) return <p className="py-6 text-center text-sm text-muted-foreground">Đang tải...</p>;

  if (prescription && !isEditing) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex justify-end gap-2">
          {visit.status === 'IN_PROGRESS' && (
            <Button variant="secondary" onClick={startEditing}>
              <Pencil className="h-4 w-4" /> Sửa
            </Button>
          )}
          <Button variant="secondary" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> In đơn thuốc
          </Button>
        </div>
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-muted-foreground">
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">Thuốc</th>
                <th className="px-4 py-3 font-medium">Liều dùng</th>
                <th className="px-4 py-3 font-medium">Tần suất</th>
                <th className="px-4 py-3 font-medium">Số ngày</th>
                <th className="px-4 py-3 font-medium">Cảnh báo</th>
              </tr>
            </thead>
            <tbody>
              {prescription.items.map((item, i) => (
                <tr key={item.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{item.medicineName}</p>
                    <p className="text-xs text-muted-foreground">{item.activeIngredient}</p>
                  </td>
                  <td className="px-4 py-3">{item.dosage}</td>
                  <td className="px-4 py-3">{item.frequency}</td>
                  <td className="px-4 py-3">{item.durationDays} ngày</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {item.allergyWarning && (
                        <Badge variant="danger"><AlertTriangle className="mr-1 h-3 w-3" />Dị ứng</Badge>
                      )}
                      {item.interactionWarning && (
                        <Badge variant="warning"><AlertTriangle className="mr-1 h-3 w-3" />Tương tác</Badge>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <PrescriptionPrintView
          prescription={prescription}
          patient={{
            patientName: visit.patientName,
            patientCode: visit.patientCode,
            doctorName: visit.doctorName,
            appointmentTime: visit.appointmentTime,
          }}
        />
      </div>
    );
  }

  if (!prescription && visit.status !== 'IN_PROGRESS') {
    return <p className="py-6 text-center text-sm text-muted-foreground">Chưa có đơn thuốc</p>;
  }

  const isPending = createPrescription.isPending || updatePrescription.isPending;

  return (
    <div className="flex flex-col gap-4">
      {/* Medicine search */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">Tìm thuốc</label>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tên thuốc hoặc hoạt chất..."
        />
        {search && filtered.length > 0 && (
          <Card className="max-h-48 overflow-y-auto p-1">
            {filtered.slice(0, 20).map((m: Medicine) => (
              <button
                key={m.id}
                onClick={() => addMedicine(m)}
                disabled={items.some((i) => i.medicineId === m.id)}
                className="flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-40"
              >
                <span>{m.name}</span>
                <span className="text-xs text-muted-foreground">{m.activeIngredient}</span>
              </button>
            ))}
          </Card>
        )}
      </div>

      {/* Items */}
      {items.length > 0 && (
        <div className="flex flex-col gap-3">
          {items.map((item, idx) => (
            <Card key={item.medicineId} className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold">{item.medicineName}</p>
                <button onClick={() => removeItem(idx)} className="text-xs text-destructive hover:underline">
                  Xóa
                </button>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-medium">Liều dùng *</label>
                  <Input
                    value={item.dosage}
                    onChange={(e) => updateItem(idx, { dosage: e.target.value })}
                    placeholder={item.unit ? `VD: 1 ${item.unit}` : 'VD: 1 viên'}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium">Tần suất *</label>
                  <Input
                    value={item.frequency}
                    onChange={(e) => updateItem(idx, { frequency: e.target.value })}
                    placeholder="VD: 2 lần/ngày"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium">Số ngày *</label>
                  <Input
                    type="number"
                    min={1}
                    value={item.durationDays}
                    onChange={(e) => updateItem(idx, { durationDays: Number(e.target.value) })}
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="mb-1 block text-xs font-medium">Hướng dẫn</label>
                  <Input
                    value={item.instruction ?? ''}
                    onChange={(e) => updateItem(idx, { instruction: e.target.value })}
                    placeholder="Hướng dẫn sử dụng (tuỳ chọn)"
                  />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div>
        <ExpandableTextInput label="Ghi chú đơn thuốc" value={note} onChange={setNote} placeholder="Ghi chú (tuỳ chọn)" />
      </div>

      <div className="flex justify-end gap-2">
        {isEditing && (
          <Button variant="secondary" onClick={() => setIsEditing(false)}>
            Hủy
          </Button>
        )}
        <Button
          onClick={handleSave}
          disabled={
            items.length === 0 ||
            items.some((i) => !i.dosage || !i.frequency || i.durationDays < 1) ||
            isPending
          }
        >
          {isEditing ? 'Lưu thay đổi' : 'Lưu đơn thuốc'}
        </Button>
      </div>
    </div>
  );
}

// ─── Preliminary Exam Tab ─────────────────────────────────────────────────────
// Sinh hiệu do bác sĩ đo trực tiếp (chuyển từ y tá — B1), cùng với ghi chú/lý
// do khám lễ tân đã ghi nhận lúc tạo lịch hẹn (B2), đặt trước bước chỉ định CLS.

function PreliminaryExamTab({ visit }: { visit: VisitListItem }) {
  const upsert = useUpsertVitalSigns(visit.id);
  const { data: existing } = useVitalSigns(visit.id);
  const [isEditing, setIsEditing] = useState(false);
  const [systolicBp, setSystolicBp] = useState('');
  const [diastolicBp, setDiastolicBp] = useState('');
  const [heartRate, setHeartRate] = useState('');
  const [temperature, setTemperature] = useState('');
  const [spo2, setSpo2] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');

  const hasSaved = existing && (
    existing.systolicBp != null || existing.diastolicBp != null ||
    existing.heartRate != null  || existing.temperature != null  ||
    existing.spo2 != null       || existing.weight != null       ||
    existing.height != null
  );

  useEffect(() => {
    if (!existing) return;
    if (existing.systolicBp != null)  setSystolicBp(String(existing.systolicBp));
    if (existing.diastolicBp != null) setDiastolicBp(String(existing.diastolicBp));
    if (existing.heartRate != null)   setHeartRate(String(existing.heartRate));
    if (existing.temperature != null) setTemperature(String(existing.temperature));
    if (existing.spo2 != null)        setSpo2(String(existing.spo2));
    if (existing.weight != null)      setWeight(String(existing.weight));
    if (existing.height != null)      setHeight(String(existing.height));
  }, [existing]);

  function handleSave() {
    const data: Record<string, number> = {};
    if (systolicBp)  data.systolicBp  = Number(systolicBp);
    if (diastolicBp) data.diastolicBp = Number(diastolicBp);
    if (heartRate)   data.heartRate   = Number(heartRate);
    if (temperature) data.temperature = Number(temperature);
    if (spo2)        data.spo2        = Number(spo2);
    if (weight)      data.weight      = Number(weight);
    if (height)      data.height      = Number(height);
    upsert.mutate(data, { onSuccess: () => setIsEditing(false) });
  }

  const hasAny = systolicBp || diastolicBp || heartRate || temperature || spo2 || weight || height;
  const showForm = !hasSaved || isEditing;

  const vitalFields = [
    { label: 'Huyết áp tâm thu (mmHg)', value: systolicBp, unit: '' },
    { label: 'Huyết áp tâm trương (mmHg)', value: diastolicBp, unit: '' },
    { label: 'Nhịp tim (lần/phút)', value: heartRate, unit: '' },
    { label: 'Nhiệt độ (°C)', value: temperature, unit: '' },
    { label: 'SpO2 (%)', value: spo2, unit: '' },
    { label: 'Cân nặng (kg)', value: weight, unit: '' },
    { label: 'Chiều cao (cm)', value: height, unit: '' },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">Sinh hiệu</p>
          {hasSaved && !isEditing && (
            <Button variant="secondary" size="sm" onClick={() => setIsEditing(true)}>
              Sửa
            </Button>
          )}
        </div>

        {showForm ? (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Huyết áp tâm thu (mmHg)</label>
                <Input type="number" placeholder="VD: 120" value={systolicBp} onChange={(e) => setSystolicBp(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Huyết áp tâm trương (mmHg)</label>
                <Input type="number" placeholder="VD: 80" value={diastolicBp} onChange={(e) => setDiastolicBp(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Nhịp tim (lần/phút)</label>
                <Input type="number" placeholder="VD: 72" value={heartRate} onChange={(e) => setHeartRate(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Nhiệt độ (°C)</label>
                <Input type="number" step="0.1" placeholder="VD: 36.5" value={temperature} onChange={(e) => setTemperature(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">SpO2 (%)</label>
                <Input type="number" placeholder="VD: 98" value={spo2} onChange={(e) => setSpo2(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Cân nặng (kg)</label>
                <Input type="number" step="0.1" placeholder="VD: 65" value={weight} onChange={(e) => setWeight(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Chiều cao (cm)</label>
                <Input type="number" step="0.1" placeholder="VD: 170" value={height} onChange={(e) => setHeight(e.target.value)} />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              {isEditing && (
                <Button variant="secondary" onClick={() => setIsEditing(false)}>
                  Hủy
                </Button>
              )}
              <Button onClick={handleSave} disabled={!hasAny || upsert.isPending}>
                {upsert.isPending ? 'Đang lưu...' : 'Lưu sinh hiệu'}
              </Button>
            </div>
          </>
        ) : (
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-4">
            {vitalFields.map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs font-medium text-muted-foreground">{label}</p>
                <p className="mt-0.5 text-sm font-semibold text-foreground">{value || '—'}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── Field helper ─────────────────────────────────────────────────────────────

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'preliminary' | 'cls' | 'result' | 'prescription';

export default function VisitDetailPage() {
  // Live-refetch this visit's CLS orders so a result entered by the lab
  // tech (`cls-order:result-ready`, sent to this doctor's own userId room)
  // shows up here without a manual refresh.
  useClsOrderEvents();

  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('preliminary');
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [clsDiagnosis, setClsDiagnosis] = useState('');

  // Chẩn đoán is only ever sent as a print-time query param (see
  // printAllClsOrdersUrl below), never persisted server-side — so it used to
  // vanish the moment the doctor navigated away from this visit (tab close,
  // back button, switching to another visit) and came back. Mirroring it
  // into localStorage keyed by visit id keeps the draft around across those
  // navigations; it's cleared once the visit is completed (see
  // handleComplete below) since a finished visit has no more use for it.
  const clsDiagnosisStorageKey = `cls-diagnosis:${id}`;
  useEffect(() => {
    setClsDiagnosis(localStorage.getItem(clsDiagnosisStorageKey) ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  useEffect(() => {
    if (clsDiagnosis) localStorage.setItem(clsDiagnosisStorageKey, clsDiagnosis);
    else localStorage.removeItem(clsDiagnosisStorageKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clsDiagnosis]);

  const { data: visits = [], isLoading } = useVisits({});
  const completeVisit = useCompleteVisit();

  const visit = useMemo(
    () => visits.find((v: VisitListItem) => v.id === id) ?? null,
    [visits, id],
  );

  const { data: medicalRecord } = useMedicalRecord(visit?.patientId, Boolean(visit));
  const hasPriorHistory = (medicalRecord?.visits ?? []).some((v) => v.id !== visit?.id);

  if (isLoading) {
    return (
      <main>
        <PageHeader title="Lượt khám" />
        <p className="p-5 text-center text-sm text-muted-foreground">Đang tải...</p>
      </main>
    );
  }

  if (!visit) {
    return (
      <main>
        <PageHeader title="Lượt khám" />
        <p className="p-5 text-center text-sm text-muted-foreground">Không tìm thấy lượt khám</p>
      </main>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'preliminary', label: 'Khám sơ bộ' },
    { key: 'cls', label: 'Chỉ định CLS' },
    { key: 'result', label: 'Kết quả khám' },
    { key: 'prescription', label: 'Đơn thuốc' },
  ];

  return (
    <main>
      <PageHeader
        title={visit.patientName}
        description={`Lượt khám · ${visit.serviceName}`}
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4" /> Quay lại
            </Button>
            {hasPriorHistory && (
              <Link href={`/doctor/medical-records?patientId=${visit.patientId}`}>
                <Button variant="secondary">
                  <FileText className="h-4 w-4" /> Hồ sơ bệnh án
                </Button>
              </Link>
            )}
            {visit.status === 'IN_PROGRESS' && (
              <Button variant="danger" onClick={() => setShowCompleteDialog(true)}>
                Hoàn tất khám
              </Button>
            )}
          </div>
        }
      />

      <div className="p-5">
        {/* Patient info */}
        <Card className="mb-5 p-5">
          <div className="grid gap-3 text-sm md:grid-cols-4">
            <Field label="Mã bệnh nhân" value={visit.patientCode} />
            <Field label="Dịch vụ" value={visit.serviceName} />
            <Field label="Giờ hẹn" value={formatAppointmentDateTime(visit.appointmentTime)} />
            <div>
              <p className="text-xs text-muted-foreground">Trạng thái</p>
              <Badge variant={visitStatusVariant[visit.status]}>{visitStatusLabel[visit.status]}</Badge>
            </div>
            {visit.calledAt && <Field label="Gọi vào lúc" value={fmt(visit.calledAt)} />}
            {visit.completedAt && <Field label="Hoàn tất lúc" value={fmt(visit.completedAt)} />}
          </div>
          {visit.note && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-amber-700">
                Lý do khám / Ghi chú lễ tân
              </p>
              <p className="text-sm text-amber-900">{visit.note}</p>
            </div>
          )}
        </Card>

        {/* Tabs */}
        <div className="mb-4 flex border-b border-border">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-5 py-2 text-sm font-medium transition-colors ${
                activeTab === t.key
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {activeTab === 'preliminary' && <PreliminaryExamTab visit={visit} />}
        {activeTab === 'cls' && <ClsTab visit={visit} diagnosis={clsDiagnosis} onDiagnosisChange={setClsDiagnosis} />}
        {activeTab === 'result' && <ExamResultTab visit={visit} />}
        {activeTab === 'prescription' && <PrescriptionTab visit={visit} />}
      </div>

      {/* Complete visit dialog */}
      <Dialog
        open={showCompleteDialog}
        onClose={() => setShowCompleteDialog(false)}
        title="Hoàn tất lượt khám"
        description="Lượt khám sẽ được đánh dấu hoàn tất. Đảm bảo đã lưu kết quả khám trước khi tiếp tục."
      >
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setShowCompleteDialog(false)}>Hủy</Button>
          <Button
            onClick={() =>
              completeVisit.mutate(visit.id, {
                onSuccess: () => {
                  localStorage.removeItem(clsDiagnosisStorageKey);
                  setShowCompleteDialog(false);
                  router.push('/doctor/visits');
                },
              })
            }
            disabled={completeVisit.isPending}
          >
            Xác nhận hoàn tất
          </Button>
        </div>
      </Dialog>
    </main>
  );
}
