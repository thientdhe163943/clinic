'use client';

import { useCallback, useState } from 'react';
import { KeyRound, Pencil, Plus, PowerOff, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import { PageHeader } from '@/components/shared/page-header';
import { Pagination } from '@/components/shared/pagination';
import {
  useAdminUsers,
  useCreateUser,
  useResetUserPassword,
  useToggleUserStatus,
  useUpdateUser,
} from '@/hooks/use-admin-users';
import { useSpecialtyOptions } from '@/hooks/use-doctor-specialties';
import { usersApi } from '@/lib/api/endpoints/users';
import { FULL_NAME_MAX_LENGTH } from '@/lib/utils/identity-validation';
import { toEmailLocalPart } from '@/lib/utils/vietnamese-slug';
import type { AdminUser, CreateUserRequest, ListUsersQuery, UpdateUserRequest, UserRole } from '@/types/auth';

const SUGGESTED_EMAIL_DOMAIN = 'clinic.vn';

// Same name -> same base local-part ("Lê Văn Sơn" both times -> "levanson").
// Whoever gets created first keeps the plain email; later collisions get a
// numeric suffix (levanson1@, levanson2@...) picked by checking which of
// that family is already taken, so ordering is purely "who got created
// first" rather than anything the admin has to think about.
async function suggestAvailableEmail(fullName: string): Promise<string> {
  const base = toEmailLocalPart(fullName);
  if (!base) return '';

  const { items } = await usersApi.listUsers({ search: base, limit: 100 });
  const taken = new Set(
    items
      // Staff accounts always have an email (create-user.dto.ts still
      // requires it — only patient accounts can go without one) — the `??
      // ''` is pure type-safety since AuthUser.email is nullable at the
      // type level regardless of role.
      .map((user) => (user.email ?? '').split('@')[0])
      .filter((localPart) => localPart === base || new RegExp(`^${base}\\d+$`).test(localPart)),
  );

  if (!taken.has(base)) return `${base}@${SUGGESTED_EMAIL_DOMAIN}`;
  let suffix = 1;
  while (taken.has(`${base}${suffix}`)) suffix += 1;
  return `${base}${suffix}@${SUGGESTED_EMAIL_DOMAIN}`;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Admin',
  RECEPTIONIST: 'Lễ tân',
  DOCTOR: 'Bác sĩ',
  NURSE: 'Y tá',
  LAB_TECH: 'Kỹ thuật viên',
  PATIENT: 'Bệnh nhân',
};

const STAFF_ROLES: UserRole[] = ['RECEPTIONIST', 'DOCTOR', 'NURSE', 'LAB_TECH'];

function userStatus(user: AdminUser): { label: string; variant: 'success' | 'warning' | 'danger' | 'muted' } {
  if (!user.isActive) return { label: 'Vô hiệu', variant: 'danger' };
  if (user.lockedAt) return { label: 'Bị khóa', variant: 'warning' };
  return { label: 'Hoạt động', variant: 'success' };
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('vi-VN');
}

// ─── Create / Edit form ──────────────────────────────────────────────────────

interface UserFormProps {
  initial?: AdminUser;
  onSubmit: (data: CreateUserRequest | UpdateUserRequest) => void;
  loading: boolean;
}

function UserForm({ initial, onSubmit, loading }: UserFormProps) {
  const [fullName, setFullName] = useState(initial?.fullName ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [role, setRole] = useState<UserRole>(initial?.role ?? 'RECEPTIONIST');
  const [idCard, setIdCard] = useState(initial?.idCard ?? '');
  const [specialtyId, setSpecialtyId] = useState(initial?.specialtyId ?? '');
  // Once the admin types into the email field themselves, stop
  // auto-suggesting on further name changes — an explicit choice always wins.
  const [emailTouched, setEmailTouched] = useState(false);
  const [suggestingEmail, setSuggestingEmail] = useState(false);
  const { data: specialties = [] } = useSpecialtyOptions();

  const isCreate = !initial;

  async function handleFullNameBlur() {
    if (!isCreate || emailTouched || !fullName.trim()) return;
    setSuggestingEmail(true);
    try {
      const suggested = await suggestAvailableEmail(fullName);
      if (suggested) setEmail(suggested);
    } finally {
      setSuggestingEmail(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isCreate) {
      onSubmit({ fullName, email, phone, role, idCard: idCard.trim() || null, specialtyId: specialtyId || null } as CreateUserRequest);
    } else {
      onSubmit({ fullName, email, phone, role, idCard: idCard.trim() || null, specialtyId: specialtyId || null } as UpdateUserRequest);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">Họ tên</label>
        <Input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          onBlur={handleFullNameBlur}
          placeholder="Nguyễn Văn A"
          maxLength={FULL_NAME_MAX_LENGTH}
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            Email {suggestingEmail && <span className="font-normal text-muted-foreground">(đang gợi ý...)</span>}
          </label>
          <Input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setEmailTouched(true);
            }}
            placeholder="user@clinic.vn"
            required
          />
          {isCreate && (
            <p className="mt-1 text-xs text-muted-foreground">
              Tự động gợi ý từ họ tên (thêm số nếu trùng tên người đã tạo trước) — có thể sửa lại.
            </p>
          )}
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">Số điện thoại</label>
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="0901234567"
            pattern="^0\d{9}$"
            title="Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 0"
            required
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">Vai trò</label>
          <Select value={role} onChange={(e) => setRole(e.target.value as UserRole)} required>
            {STAFF_ROLES.map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </Select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">CCCD/CMND</label>
          <Input
            value={idCard}
            onChange={(e) => setIdCard(e.target.value)}
            placeholder="079xxxxxxxxx"
            pattern="^\d{12}$"
            title="CCCD/CMND phải gồm đúng 12 chữ số"
          />
        </div>
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">Chuyên khoa</label>
        <Select value={specialtyId} onChange={(e) => setSpecialtyId(e.target.value)}>
          <option value="">Không thuộc chuyên khoa nào</option>
          {specialties.map((specialty) => (
            <option key={specialty.id} value={specialty.id}>{specialty.name}</option>
          ))}
        </Select>
        {role === 'DOCTOR' && (
          <p className="mt-1 text-xs text-muted-foreground">
            Đối với bác sĩ, chuyên khoa hồ sơ hành nghề (hiển thị công khai) được quản lý riêng ở màn Chuyên khoa bác sĩ.
          </p>
        )}
      </div>
      {isCreate && (
        <p className="text-xs text-muted-foreground">
          Mật khẩu mặc định sẽ được cấp, người dùng phải đổi mật khẩu sau lần đăng nhập đầu tiên.
        </p>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={loading}>
          {loading ? 'Đang lưu...' : isCreate ? 'Tạo tài khoản' : 'Lưu thay đổi'}
        </Button>
      </div>
    </form>
  );
}

// ─── Reset password form ─────────────────────────────────────────────────────

function ResetPasswordForm({ onSubmit, loading }: { onSubmit: () => void; loading: boolean }) {
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Tài khoản này sẽ được đặt lại về mật khẩu mặc định. Người dùng sẽ được yêu cầu đổi mật khẩu khi đăng nhập lần tới.
      </p>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={loading}>
          {loading ? 'Đang đặt lại...' : 'Đặt lại mật khẩu'}
        </Button>
      </div>
    </form>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

type ModalState =
  | { type: 'none' }
  | { type: 'create' }
  | { type: 'edit'; user: AdminUser }
  | { type: 'reset'; user: AdminUser };

export default function AdminUsersPage() {
  const [query, setQuery] = useState<ListUsersQuery>({ page: 1, limit: 10 });
  const [modal, setModal] = useState<ModalState>({ type: 'none' });

  const { data, isLoading, isError } = useAdminUsers(query);
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const toggleStatus = useToggleUserStatus();
  const resetPassword = useResetUserPassword();

  const closeModal = useCallback(() => setModal({ type: 'none' }), []);

  function setSearch(search: string) {
    setQuery((q) => ({ ...q, search: search || undefined, page: 1 }));
  }

  function setRole(role: string) {
    setQuery((q) => ({ ...q, role: (role as UserRole) || undefined, page: 1 }));
  }

  function setStatus(status: string) {
    setQuery((q) => ({ ...q, status: (status as ListUsersQuery['status']) || undefined, page: 1 }));
  }

  async function handleCreate(data: CreateUserRequest | UpdateUserRequest) {
    await createUser.mutateAsync(data as CreateUserRequest);
    closeModal();
  }

  async function handleEdit(data: CreateUserRequest | UpdateUserRequest) {
    if (modal.type !== 'edit') return;
    await updateUser.mutateAsync({ id: modal.user.id, input: data as UpdateUserRequest });
    closeModal();
  }

  async function handleResetPassword() {
    if (modal.type !== 'reset') return;
    await resetPassword.mutateAsync(modal.user.id);
    closeModal();
  }

  const items = data?.items ?? [];
  const meta = data?.meta;

  return (
    <div className="min-h-full bg-background">
      <PageHeader
        title="Quản lý người dùng"
        description="Tài khoản nhân sự, bác sĩ, kỹ thuật viên và bệnh nhân"
        action={
          <Button onClick={() => setModal({ type: 'create' })}>
            <Plus className="h-4 w-4" />
            Tạo tài khoản
          </Button>
        }
      />

      <section className="space-y-4 p-5">
        {/* Filters */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 flex-col gap-2 sm:flex-row">
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Tên, email hoặc số điện thoại..."
                defaultValue={query.search ?? ''}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select
              className="w-full sm:w-44"
              value={query.role ?? ''}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="">Tất cả vai trò</option>
              {STAFF_ROLES.map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </Select>
            <Select
              className="w-full sm:w-40"
              value={query.status ?? ''}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">Tất cả trạng thái</option>
              <option value="active">Hoạt động</option>
              <option value="locked">Bị khóa</option>
              <option value="inactive">Vô hiệu</option>
            </Select>
          </div>
          <Badge variant="muted">{meta ? `${meta.total} tài khoản` : '...'}</Badge>
        </div>

        {/* Table */}
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] border-collapse text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="h-10 px-4 font-semibold">STT</th>
                  <th className="h-10 px-4 font-semibold">Họ tên</th>
                  <th className="h-10 px-4 font-semibold">Email</th>
                  <th className="h-10 px-4 font-semibold">Số điện thoại</th>
                  <th className="h-10 px-4 font-semibold">CCCD</th>
                  <th className="h-10 px-4 font-semibold">Vai trò</th>
                  <th className="h-10 px-4 font-semibold">Chuyên khoa</th>
                  <th className="h-10 px-4 font-semibold">Trạng thái</th>
                  <th className="h-10 px-4 font-semibold">Đăng nhập lần cuối</th>
                  <th className="h-10 px-4 font-semibold">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={10} className="h-20 px-4 text-center text-muted-foreground">
                      Đang tải...
                    </td>
                  </tr>
                )}
                {isError && (
                  <tr>
                    <td colSpan={10} className="h-20 px-4 text-center text-destructive">
                      Không thể tải dữ liệu. Vui lòng thử lại.
                    </td>
                  </tr>
                )}
                {!isLoading && !isError && items.length === 0 && (
                  <tr>
                    <td colSpan={10} className="h-20 px-4 text-center text-muted-foreground">
                      Không có dữ liệu
                    </td>
                  </tr>
                )}
                {items.map((user, idx) => {
                  const st = userStatus(user);
                  const rowNum = ((query.page ?? 1) - 1) * (query.limit ?? 20) + idx + 1;
                  return (
                    <tr key={user.id} className="border-t border-border bg-white hover:bg-muted/30">
                      <td className="h-12 px-4 text-muted-foreground">{rowNum}</td>
                      <td className="h-12 px-4 font-medium text-foreground">{user.fullName}</td>
                      <td className="h-12 px-4 text-muted-foreground">{user.email}</td>
                      <td className="h-12 px-4 text-muted-foreground">{user.phone}</td>
                      <td className="h-12 px-4 text-muted-foreground">{user.idCard ?? '—'}</td>
                      <td className="h-12 px-4">
                        <Badge variant="default">{ROLE_LABELS[user.role] ?? user.role}</Badge>
                      </td>
                      <td className="h-12 px-4 text-muted-foreground">{user.specialtyName ?? '—'}</td>
                      <td className="h-12 px-4">
                        <Badge variant={st.variant}>{st.label}</Badge>
                      </td>
                      <td className="h-12 px-4 text-muted-foreground">{formatDate(user.lastLoginAt)}</td>
                      <td className="h-12 px-4">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Chỉnh sửa"
                            onClick={() => setModal({ type: 'edit', user })}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Đặt lại mật khẩu"
                            onClick={() => setModal({ type: 'reset', user })}
                          >
                            <KeyRound className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title={user.isActive ? 'Vô hiệu hóa' : 'Kích hoạt'}
                            className={user.isActive ? 'text-destructive hover:text-destructive' : 'text-emerald-600 hover:text-emerald-600'}
                            onClick={() => toggleStatus.mutate(user.id)}
                            disabled={toggleStatus.isPending}
                          >
                            <PowerOff className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Pagination */}
        {meta && (
          <Pagination
            page={meta.page}
            totalPages={meta.totalPages}
            total={meta.total}
            onPageChange={(page) => setQuery((q) => ({ ...q, page }))}
          />
        )}
      </section>

      {/* Modals */}
      <Modal open={modal.type === 'create'} onClose={closeModal} title="Tạo tài khoản mới">
        <UserForm onSubmit={handleCreate} loading={createUser.isPending} />
      </Modal>

      <Modal
        open={modal.type === 'edit'}
        onClose={closeModal}
        title={modal.type === 'edit' ? `Chỉnh sửa: ${modal.user.fullName}` : ''}
      >
        {modal.type === 'edit' && (
          <UserForm initial={modal.user} onSubmit={handleEdit} loading={updateUser.isPending} />
        )}
      </Modal>

      <Modal
        open={modal.type === 'reset'}
        onClose={closeModal}
        title={modal.type === 'reset' ? `Đặt lại mật khẩu: ${modal.user.fullName}` : ''}
      >
        {modal.type === 'reset' && (
          <ResetPasswordForm onSubmit={handleResetPassword} loading={resetPassword.isPending} />
        )}
      </Modal>
    </div>
  );
}
