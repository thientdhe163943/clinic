import type { Metadata } from 'next';
import { PatientSiteShell } from '@/components/shared/patient-site-shell';
import { SectionHeading } from '@/components/shared/section-heading';

export const metadata: Metadata = {
  title: 'Chính sách bảo mật | Phòng Khám Đa Khoa Âu Cơ Phú Hà',
  description: 'Chính sách bảo mật thông tin cá nhân và dữ liệu sức khỏe của người bệnh tại Phòng Khám Đa Khoa Âu Cơ Phú Hà.',
};

const SECTIONS = [
  {
    title: '1. Mục đích thu thập thông tin',
    body: 'Thông tin cá nhân và dữ liệu sức khỏe của người bệnh được thu thập nhằm phục vụ công tác khám, chẩn đoán, điều trị, đặt lịch khám, tra cứu kết quả và chăm sóc khách hàng tại phòng khám.',
  },
  {
    title: '2. Phạm vi thu thập',
    body: 'Bao gồm họ tên, ngày sinh, giới tính, số điện thoại, email, địa chỉ, số căn cước công dân/bảo hiểm y tế (nếu có) và các thông tin y tế liên quan trong quá trình khám chữa bệnh.',
  },
  {
    title: '3. Phạm vi sử dụng thông tin',
    body: 'Thông tin được sử dụng nội bộ trong hệ thống quản lý phòng khám để phục vụ khám chữa bệnh, không được sử dụng cho mục đích quảng cáo hoặc chia sẻ cho bên thứ ba khi chưa có sự đồng ý của người bệnh, trừ trường hợp pháp luật yêu cầu.',
  },
  {
    title: '4. Thời gian lưu trữ thông tin',
    body: 'Hồ sơ bệnh án và dữ liệu liên quan được lưu trữ theo quy định của Bộ Y tế về thời hạn lưu trữ hồ sơ bệnh án.',
  },
  {
    title: '5. Đơn vị thu thập và quản lý thông tin',
    body: 'Phòng Khám Đa Khoa Âu Cơ Phú Hà — Số 38, Minh Lang, Việt Trì, Phú Thọ. Hotline: 0969.434.729.',
  },
  {
    title: '6. Quyền của người bệnh',
    body: 'Người bệnh có quyền yêu cầu truy cập, chỉnh sửa thông tin cá nhân của mình đã cung cấp cho phòng khám bằng cách liên hệ trực tiếp qua hotline hoặc quầy lễ tân.',
  },
];

export default function PrivacyPolicyPage() {
  return (
    <PatientSiteShell breadcrumb={[{ label: 'Chính sách bảo mật' }]}>
      <section className="mx-auto max-w-3xl p-5 py-12">
        <SectionHeading
          eyebrow="Pháp lý"
          title="Chính sách bảo mật"
          description="Áp dụng cho toàn bộ thông tin cá nhân và dữ liệu sức khỏe được thu thập qua hệ thống website và tại phòng khám."
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
