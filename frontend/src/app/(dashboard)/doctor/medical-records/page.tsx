'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { MedicalRecordsWorkspace } from '@/components/shared/medical-records-workspace';

function DoctorMedicalRecordsContent() {
  const searchParams = useSearchParams();
  const patientId = searchParams.get('patientId');
  return <MedicalRecordsWorkspace initialPatientId={patientId} />;
}

export default function DoctorMedicalRecordsPage() {
  return (
    <Suspense fallback={null}>
      <DoctorMedicalRecordsContent />
    </Suspense>
  );
}
