'use client';

import { CalendarPlus, ClipboardList, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { FaqAccordion } from '@/components/shared/faq-accordion';
import { usePublicServices } from '@/hooks/use-public-services';

function formatPrice(price: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
}

const GENERIC_FAQS = [
  {
    question: 'Tôi có cần đặt lịch trước không?',
    answer:
      'Bạn nên đặt lịch trước qua hệ thống hoặc hotline để được lễ tân sắp xếp khung giờ phù hợp, hạn chế thời gian chờ khi đến khám.',
  },
  {
    question: 'Dịch vụ này có áp dụng bảo hiểm y tế không?',
    answer:
      'Vui lòng liên hệ hotline hoặc quầy lễ tân để được tư vấn chi tiết về việc áp dụng bảo hiểm y tế/bảo hiểm bảo lãnh cho dịch vụ cụ thể.',
  },
  {
    question: 'Giá dịch vụ đã bao gồm những gì?',
    answer: 'Giá niêm yết là chi phí thực hiện dịch vụ tại phòng khám; chi phí thuốc, vật tư phát sinh (nếu có) sẽ được tư vấn rõ trước khi thực hiện.',
  },
  {
    question: 'Tôi cần chuẩn bị gì trước khi thực hiện dịch vụ?',
    answer: 'Tùy loại dịch vụ, nhân viên y tế sẽ hướng dẫn cụ thể (nhịn ăn, mang theo kết quả cũ...) khi xác nhận lịch hẹn.',
  },
];

export function ServiceDetail({ id }: { id: string }) {
  const { data: services, isLoading } = usePublicServices();
  const service = services?.find((s) => s.id === id);

  if (isLoading) {
    return (
      <section className="mx-auto max-w-4xl p-5 py-12">
        <p className="rounded-md bg-muted p-6 text-center text-sm text-muted-foreground">Đang tải dịch vụ...</p>
      </section>
    );
  }

  if (!service) {
    return (
      <section className="mx-auto max-w-4xl p-5 py-12 text-center">
        <p className="text-lg font-semibold text-foreground">Không tìm thấy dịch vụ</p>
        <Link href="/clinic/services" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
          ← Quay lại danh sách dịch vụ
        </Link>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-4xl p-5 py-12">
      <div className="flex flex-col gap-2">
        {service.specialtyName && (
          <span className="inline-flex w-fit items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            {service.specialtyName}
          </span>
        )}
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">{service.name}</h1>
        {service.serviceCode && <p className="text-sm text-muted-foreground">Mã dịch vụ: {service.serviceCode}</p>}
      </div>

      <Card className="mt-6 flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Giá dịch vụ</p>
          <p className="text-2xl font-bold text-primary">{formatPrice(service.price)}</p>
        </div>
        <Link
          href="/guest-booking"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          <CalendarPlus className="h-4 w-4" />
          Đặt lịch khám
        </Link>
      </Card>

      <div className="mt-8">
        <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
          <ClipboardList className="h-5 w-5 text-primary" />
          Mô tả dịch vụ
        </h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {service.description ?? 'Thông tin mô tả chi tiết đang được cập nhật. Vui lòng liên hệ hotline để được tư vấn.'}
        </p>
      </div>

      <div className="mt-10">
        <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
          <ShieldCheck className="h-5 w-5 text-primary" />
          Câu hỏi thường gặp
        </h2>
        <div className="mt-3">
          <FaqAccordion items={GENERIC_FAQS} />
        </div>
      </div>
    </section>
  );
}
