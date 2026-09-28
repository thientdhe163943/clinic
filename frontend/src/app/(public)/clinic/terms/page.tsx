import type { Metadata } from 'next';
import { PatientSiteShell } from '@/components/shared/patient-site-shell';
import { SectionHeading } from '@/components/shared/section-heading';

export const metadata: Metadata = {
  title: 'Điều khoản sử dụng | Phòng Khám Đa Khoa Âu Cơ Phú Hà',
  description: 'Điều khoản sử dụng dịch vụ đặt lịch khám và tra cứu kết quả trực tuyến tại Phòng Khám Đa Khoa Âu Cơ Phú Hà.',
};

const SECTIONS = [
  {
    title: '1. Phạm vi áp dụng',
    body: 'Điều khoản này áp dụng cho người dùng khi truy cập và sử dụng website, dịch vụ đặt lịch khám và tra cứu kết quả trực tuyến của Phòng Khám Đa Khoa Âu Cơ Phú Hà.',
  },
  {
    title: '2. Trách nhiệm của người dùng',
    body: 'Người dùng cam kết cung cấp thông tin đăng ký khám chính xác, trung thực; chịu trách nhiệm bảo mật thông tin đăng nhập tài khoản của mình.',
  },
  {
    title: '3. Đặt lịch và hủy lịch khám',
    body: 'Lịch khám đặt qua hệ thống sẽ được lễ tân xác nhận. Người dùng có thể đổi/hủy lịch hẹn bằng cách liên hệ hotline trước giờ hẹn; phòng khám có quyền điều chỉnh lịch hẹn trong trường hợp phát sinh bất khả kháng.',
  },
  {
    title: '4. Giới hạn trách nhiệm',
    body: 'Thông tin trên website (bao gồm nội dung dịch vụ, gói khám, tin tức) mang tính chất tham khảo; thông tin chẩn đoán và điều trị chính thức được thực hiện trực tiếp bởi bác sĩ tại phòng khám.',
  },
  {
    title: '5. Quyền sở hữu trí tuệ',
    body: 'Toàn bộ nội dung, hình ảnh, logo trên website thuộc quyền sở hữu của Phòng Khám Đa Khoa Âu Cơ Phú Hà, nghiêm cấm sao chép, sử dụng cho mục đích thương mại khi chưa được cho phép.',
  },
  {
    title: '6. Thay đổi điều khoản',
    body: 'Phòng khám có quyền cập nhật, điều chỉnh điều khoản sử dụng để phù hợp với quy định pháp luật và hoạt động thực tế; các thay đổi sẽ được công bố trên website.',
  },
];

export default function TermsPage() {
  return (
    <PatientSiteShell breadcrumb={[{ label: 'Điều khoản sử dụng' }]}>
      <section className="mx-auto max-w-3xl p-5 py-12">
        <SectionHeading
          eyebrow="Pháp lý"
          title="Điều khoản sử dụng"
          description="Vui lòng đọc kỹ trước khi sử dụng website và các dịch vụ trực tuyến của phòng khám."
        />
        <div className="mt-8 space-y-6">
          {SECTIONS.map((section) => (
            <div key={section.title}>
              <h2 className="text-base font-bold text-foreground">{section.title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{section.body}</p>
            </div>
          ))}
        </div>
      </section>
    </PatientSiteShell>
  );
}
