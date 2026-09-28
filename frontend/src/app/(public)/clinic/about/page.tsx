import type { Metadata } from 'next';
import { Eye, Target } from 'lucide-react';
import { PatientSiteShell } from '@/components/shared/patient-site-shell';
import { SectionHeading } from '@/components/shared/section-heading';
import { Card } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Giới thiệu | Phòng Khám Đa Khoa Âu Cơ Phú Hà',
  description:
    'Tìm hiểu lịch sử hình thành, sứ mệnh - tầm nhìn, giá trị cốt lõi, cơ sở vật chất và chứng nhận của Phòng Khám Đa Khoa Âu Cơ Phú Hà — thành lập từ năm 1998.',
};

// Rendered as a numbered list (docs/design.md 4.5 rule 3), not another
// icon-circle card grid — that pattern is already used once below for
// Mission/Vision. Copy avoids "hiện đại/tận tâm/uy tín" filler (rule 5) in
// favor of what each value concretely means in practice.
const CORE_VALUES = [
  {
    title: 'Lấy người bệnh làm trung tâm',
    text: 'Mọi quy trình khám chữa bệnh đều đặt sự an toàn và trải nghiệm của người bệnh lên hàng đầu.',
  },
  {
    title: 'Bác sĩ chuyên khoa I và sau đại học',
    text: 'Đội ngũ bác sĩ trực tiếp thăm khám đạt trình độ chuyên khoa I trở lên, thường xuyên cập nhật phác đồ điều trị mới.',
  },
  {
    title: 'Đầu tư trang thiết bị theo từng năm',
    text: 'Máy siêu âm, X-quang kỹ thuật số và quy trình xét nghiệm, nội soi được chuẩn hóa để giảm sai sót chẩn đoán.',
  },
  {
    title: 'Minh bạch chi phí',
    text: 'Bảng giá dịch vụ công khai trên website, báo chi phí trước khi chỉ định xét nghiệm hoặc thủ thuật phát sinh.',
  },
];

const FACILITIES = [
  'Hệ thống máy siêu âm, X-quang kỹ thuật số',
  'Phòng xét nghiệm đạt chuẩn, trả kết quả nhanh chóng',
  'Phòng nội soi tiêu hóa vô trùng, trang thiết bị nhập khẩu',
  '10 chuyên khoa và phòng chức năng: Nội, Ngoại, Sản, Tai Mũi Họng, Mắt, Răng Hàm Mặt, X-Quang, Siêu âm, Xét nghiệm, Nội soi tiêu hóa',
  'Quầy dược phục vụ tại chỗ, thuận tiện cho người bệnh sau khám',
  'Không gian chờ khám rộng rãi, sạch sẽ, thoáng mát',
];

const CERTIFICATIONS = [
  'Giấy phép hoạt động khám bệnh, chữa bệnh do Sở Y tế tỉnh Phú Thọ cấp',
  'Đội ngũ bác sĩ đạt chứng chỉ hành nghề theo đúng chuyên khoa đăng ký',
  'Cơ sở vật chất, trang thiết bị được kiểm định định kỳ theo quy định ngành y tế',
];

export default function AboutPage() {
  return (
    <PatientSiteShell breadcrumb={[{ label: 'Giới thiệu' }]}>
      <section className="bg-primary-fixed/60">
        <div className="mx-auto max-w-4xl px-5 py-14 text-center">
          <SectionHeading
            align="center"
            title="Phòng Khám Đa Khoa Âu Cơ Phú Hà"
            titleClassName="text-brand font-bold"
            description="Cơ sở y tế tư nhân đầu tiên của tỉnh Phú Thọ tổ chức khám chữa bệnh theo mô hình đa khoa — 10 chuyên khoa, phòng xét nghiệm và chẩn đoán hình ảnh tại chỗ, phục vụ người dân Phú Thọ và các vùng lân cận từ năm 1998."
          />
        </div>
      </section>

      {/* Overview & history */}
      <section className="mx-auto max-w-6xl p-5 py-14">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <SectionHeading eyebrow="Tổng quan" title="Phòng khám của chúng tôi" />
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              Phòng Khám Đa Khoa Âu Cơ Phú Hà đặt tại Việt Trì, Phú Thọ, tổ chức khám và điều trị theo 10 chuyên khoa:
              Nội, Ngoại, Sản, Tai Mũi Họng, Mắt, Răng Hàm Mặt cùng các chuyên khoa cận lâm sàng (X-Quang, Siêu âm,
              Xét nghiệm, Nội soi tiêu hóa).
            </p>
          </div>
          <div>
            <SectionHeading eyebrow="Lịch sử hình thành" title="Hành trình 25+ năm" />
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              Đầu năm 1998, một nhóm các bác sỹ đương chức và nghỉ hưu tại Phú Thọ đã cùng sáng lập Phòng khám Âu Cơ —
              cơ sở y tế tư nhân đầu tiên của tỉnh tổ chức khám chữa bệnh theo mô hình phòng khám đa khoa. Trải qua
              hơn 25 năm hoạt động, phòng khám vẫn giữ nguyên địa điểm tại Việt Trì, phục vụ người dân Phú Thọ và các
              vùng lân cận.
            </p>
          </div>
        </div>
      </section>

      {/* Mission & Vision — plain icon + top accent border instead of the
          bg-primary/10 rounded-full badge (that pattern is reserved for
          Core values below, see docs/design.md 4.5 rule 3). */}
      <section className="border-y border-border bg-secondary/30 px-5 py-14">
        <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-2">
          <Card className="flex flex-col gap-3 border-t-4 border-t-primary p-6">
            <Target className="h-6 w-6 text-primary" />
            <h3 className="font-display text-lg font-semibold text-foreground">Sứ mệnh</h3>
            <p className="text-sm leading-6 text-muted-foreground">
              Mang đến dịch vụ khám chữa bệnh chất lượng cao và an toàn, giúp người dân Phú Thọ và các vùng lân cận
              tiếp cận dịch vụ y tế chuyên khoa ngay tại địa phương, không phải di chuyển xa lên tuyến trên.
            </p>
          </Card>
          <Card className="flex flex-col gap-3 border-t-4 border-t-accent p-6">
            <Eye className="h-6 w-6 text-accent" />
            <h3 className="font-display text-lg font-semibold text-foreground">Tầm nhìn</h3>
            <p className="text-sm leading-6 text-muted-foreground">
              Trở thành hệ thống phòng khám đa khoa tư nhân hàng đầu khu vực trung du miền núi phía Bắc, mở rộng thêm
              chuyên khoa và đầu tư trang thiết bị theo nhu cầu khám chữa bệnh thực tế của người dân.
            </p>
          </Card>
        </div>
      </section>

      {/* Core values — numbered list, not another icon-circle card grid */}
      <section className="mx-auto max-w-6xl p-5 py-14">
        <SectionHeading eyebrow="Giá trị cốt lõi" title="Điều làm nên sự khác biệt" align="center" className="mx-auto max-w-2xl" />
        <div className="mt-10 divide-y divide-border border-y border-border">
          {CORE_VALUES.map((value, index) => (
            <div key={value.title} className="grid gap-2 py-6 sm:grid-cols-[72px_1fr] sm:gap-6">
              <span className="font-display text-3xl font-semibold text-primary/30 sm:text-4xl">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div>
                <p className="font-display text-base font-semibold text-foreground">{value.title}</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{value.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Facilities */}
      <section className="border-t border-border bg-secondary/30 px-5 py-14">
        <div className="mx-auto max-w-6xl">
          <SectionHeading eyebrow="Cơ sở vật chất" title="Trang thiết bị & không gian khám chữa bệnh" />
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {FACILITIES.map((item) => (
              <Card key={item} className="p-4 text-sm text-muted-foreground">
                {item}
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Certifications */}
      <section className="mx-auto max-w-6xl p-5 py-14">
        <SectionHeading eyebrow="Pháp lý" title="Chứng nhận & giấy phép hoạt động" />
        <div className="mt-6 grid gap-3">
          {CERTIFICATIONS.map((item) => (
            <Card key={item} className="p-4 text-sm text-muted-foreground">
              {item}
            </Card>
          ))}
        </div>
      </section>
    </PatientSiteShell>
  );
}
