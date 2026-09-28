'use client';

import { useEffect, useState } from 'react';
import { doctorSpecialtiesApi } from '@/lib/api/endpoints/doctor-specialties';
import { usersApi } from '@/lib/api/endpoints/users';
import type { AdminUser } from '@/types/auth';

const SCHEDULABLE_ROLES = ['DOCTOR', 'NURSE', 'LAB_TECH', 'RECEPTIONIST'] as const;

// limit=100 is the backend's hard max per page (PaginationDto @Max(100)) —
// a single page silently dropped every user past the first 100 for any role
// that grew past that, making the rest permanently unselectable for
// scheduling/leave. Page through meta.totalPages instead of assuming one
// page is enough.
async function fetchAllUsersForRole(role: (typeof SCHEDULABLE_ROLES)[number]): Promise<AdminUser[]> {
  const first = await usersApi.listUsers({ limit: 100, role, page: 1 });
  const pages = [first.items];
  for (let page = 2; page <= first.meta.totalPages; page += 1) {
    const next = await usersApi.listUsers({ limit: 100, role, page });
    pages.push(next.items);
  }
  return pages.flat();
}

// DOCTOR specialty lives on DoctorProfile, not on the base User row the
// /users endpoint (fetchAllUsersForRole above) returns — so it has to be
// fetched separately from the doctor-specialties admin listing and merged
// in by userId. NURSE/LAB_TECH/RECEPTIONIST specialty comes straight off
// AdminUser.specialtyId already, no merge needed for them.
async function fetchAllDoctorSpecialtiesByUserId(): Promise<Map<string, { specialtyId: string | null; specialtyName: string | null }>> {
  const first = await doctorSpecialtiesApi.listDoctorProfiles({ limit: 100, page: 1 });
  const pages = [first.items];
  for (let page = 2; page <= first.meta.totalPages; page += 1) {
    const next = await doctorSpecialtiesApi.listDoctorProfiles({ limit: 100, page });
    pages.push(next.items);
  }
  const map = new Map<string, { specialtyId: string | null; specialtyName: string | null }>();
  for (const profile of pages.flat()) {
    map.set(profile.userId, { specialtyId: profile.specialtyId, specialtyName: profile.specialtyName });
  }
  return map;
}

// Feature 39: chỉ Bác sĩ/Y tá/KTV/Lễ tân mới được xếp lịch — dùng chung ở
// mọi màn liên quan lịch làm việc (tạo/lọc/hàng loạt) để tránh
// lặp lại bug "dropdown load cả bệnh nhân/admin" (sửa 2026-07-08).
export function useStaffOptions(): AdminUser[] {
  const [staffOptions, setStaffOptions] = useState<AdminUser[]>([]);

  useEffect(() => {
    Promise.all([
      Promise.all(SCHEDULABLE_ROLES.map(fetchAllUsersForRole)),
      fetchAllDoctorSpecialtiesByUserId(),
    ])
      .then(([usersByRole, doctorSpecialties]) => {
        const merged = usersByRole.flat().map((user) => {
          if (user.role !== 'DOCTOR') return user;
          const specialty = doctorSpecialties.get(user.id);
          return { ...user, specialtyId: specialty?.specialtyId ?? null, specialtyName: specialty?.specialtyName ?? null };
        });
        setStaffOptions(merged);
      })
      .catch(() => setStaffOptions([]));
  }, []);

  return staffOptions;
}
