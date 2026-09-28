export default () => ({
  clinic: {
    name: process.env.CLINIC_NAME ?? 'Phòng Khám Đa Khoa Âu Cơ Phú Hà',
    description:
      process.env.CLINIC_DESCRIPTION ??
      '10 chuyên khoa, phòng chức năng — đặt lịch khám và tra cứu kết quả trực tuyến nhanh chóng, tiện lợi.',
    address: process.env.CLINIC_ADDRESS ?? 'Số 38, Minh Lang, Việt Trì, Phú Thọ',
    phone: process.env.CLINIC_PHONE ?? '0969.434.729',
    supportPhone: process.env.CLINIC_SUPPORT_PHONE ?? '(0210) 3.845.618',
    email: process.env.CLINIC_EMAIL ?? 'lienhe@aucophuha.vn',
    operatingHours: process.env.CLINIC_OPERATING_HOURS ?? 'Tất cả các ngày trong tuần, 07:00 - 17:30',
    examinationSteps: (
      process.env.CLINIC_EXAMINATION_STEPS ??
      'Đăng ký/đặt lịch khám;Tiếp đón và lấy số thứ tự;Khám lâm sàng với bác sĩ chuyên khoa;Thực hiện cận lâm sàng (nếu được chỉ định);Nhận kết quả và tư vấn điều trị;Thanh toán viện phí'
    )
      .split(';')
      .map((step) => step.trim())
      .filter(Boolean),
  },
});
