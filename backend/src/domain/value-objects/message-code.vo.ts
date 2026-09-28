export const MSG = {
  // INFO — xem docs/system_messages.md để biết context đầy đủ
  INFO_0001: 'MSG_INFO_0001', // Đăng nhập thành công
  INFO_0002: 'MSG_INFO_0002', // Lịch hẹn được xác nhận
  INFO_0004: 'MSG_INFO_0004', // Bệnh nhân đặt lịch
  INFO_0005: 'MSG_INFO_0005', // Cập nhật hồ sơ bệnh nhân
  INFO_0006: 'MSG_INFO_0006', // Thanh toán hóa đơn
  INFO_0007: 'MSG_INFO_0007', // Tạo tài khoản
  INFO_0008: 'MSG_INFO_0008', // Đổi mật khẩu
  INFO_0009: 'MSG_INFO_0009', // Đăng xuất
  INFO_0010: 'MSG_INFO_0010', // Gửi mã OTP
  INFO_0011: 'MSG_INFO_0011', // Đặt lại mật khẩu
  INFO_0012: 'MSG_INFO_0012', // Cập nhật hồ sơ cá nhân
  INFO_0013: 'MSG_INFO_0013', // Cập nhật tài khoản nhân sự
  INFO_0014: 'MSG_INFO_0014', // Kích hoạt tài khoản
  INFO_0015: 'MSG_INFO_0015', // Vô hiệu hóa tài khoản
  INFO_0016: 'MSG_INFO_0016', // Mở khóa tài khoản
  INFO_0017: 'MSG_INFO_0017', // Admin reset mật khẩu
  INFO_0018: 'MSG_INFO_0018', // Tạo hồ sơ bệnh nhân
  INFO_0021: 'MSG_INFO_0021', // Tạo phòng
  INFO_0022: 'MSG_INFO_0022', // Cập nhật phòng
  INFO_0023: 'MSG_INFO_0023', // Kích hoạt phòng
  INFO_0024: 'MSG_INFO_0024', // Vô hiệu hóa phòng
  INFO_0025: 'MSG_INFO_0025', // Tạo dịch vụ
  INFO_0026: 'MSG_INFO_0026', // Cập nhật dịch vụ
  INFO_0027: 'MSG_INFO_0027', // Xóa dịch vụ
  INFO_0030: 'MSG_INFO_0030', // Cập nhật hồ sơ bác sĩ
  INFO_0031: 'MSG_INFO_0031', // Tạo lịch làm việc
  INFO_0032: 'MSG_INFO_0032', // Cập nhật lịch làm việc
  INFO_0033: 'MSG_INFO_0033', // Xóa lịch làm việc
  INFO_0034: 'MSG_INFO_0034', // Lễ tân tạo lịch hẹn
  INFO_0035: 'MSG_INFO_0035', // Từ chối lịch hẹn
  INFO_0036: 'MSG_INFO_0036', // Cập nhật lịch hẹn
  INFO_0037: 'MSG_INFO_0037', // Hủy lịch hẹn
  INFO_0038: 'MSG_INFO_0038', // Check-in bệnh nhân
  INFO_0044: 'MSG_INFO_0044', // Gọi bệnh nhân vào phòng khám
  INFO_0045: 'MSG_INFO_0045', // Bắt đầu khám
  INFO_0046: 'MSG_INFO_0046', // Hoàn thành lượt khám
  INFO_0047: 'MSG_INFO_0047', // Tạo phiếu CLS
  INFO_0048: 'MSG_INFO_0048', // Gọi vào phòng CLS
  INFO_0049: 'MSG_INFO_0049', // Cập nhật kết quả CLS
  INFO_0051: 'MSG_INFO_0051', // Upload file CLS
  INFO_0052: 'MSG_INFO_0052', // Lưu kết quả khám
  INFO_0053: 'MSG_INFO_0053', // Cập nhật kết quả khám
  INFO_0055: 'MSG_INFO_0055', // Tạo đơn thuốc
  INFO_0060: 'MSG_INFO_0060', // Tạo hóa đơn
  INFO_0063: 'MSG_INFO_0063', // Tạo danh mục vật tư
  INFO_0064: 'MSG_INFO_0064', // Cập nhật danh mục vật tư
  INFO_0065: 'MSG_INFO_0065', // Xóa danh mục vật tư
  INFO_0066: 'MSG_INFO_0066', // Tạo nhà cung cấp
  INFO_0067: 'MSG_INFO_0067', // Cập nhật nhà cung cấp
  INFO_0068: 'MSG_INFO_0068', // Xóa nhà cung cấp
  INFO_0069: 'MSG_INFO_0069', // Tạo vật tư
  INFO_0070: 'MSG_INFO_0070', // Cập nhật vật tư
  INFO_0071: 'MSG_INFO_0071', // Nhập kho vật tư
  INFO_0072: 'MSG_INFO_0072', // Phân phối vật tư
  INFO_0076: 'MSG_INFO_0076', // Thêm thuốc vào danh mục
  INFO_0077: 'MSG_INFO_0077', // Cập nhật thông tin thuốc
  INFO_0078: 'MSG_INFO_0078', // Xóa thuốc khỏi danh mục
  INFO_0080: 'MSG_INFO_0080', // Tạm rời phòng khám chờ kết quả CLS
  INFO_0081: 'MSG_INFO_0081', // Đánh dấu vắng mặt
  INFO_0083: 'MSG_INFO_0083', // Đánh dấu thông báo đã đọc
  INFO_0084: 'MSG_INFO_0084', // Đánh dấu tất cả thông báo đã đọc
  INFO_0087: 'MSG_INFO_0087', // Tạo lịch làm việc hàng loạt
  INFO_0088: 'MSG_INFO_0088', // Sửa phiếu CLS
  INFO_0089: 'MSG_INFO_0089', // Lưu chỉ số sinh hiệu
  // INFO_0090-0092: doctor-specialties.controller.ts's specialty CRUD had no
  // @MsgCode at all (frontend hardcoded the success toast text instead) —
  // Phase 6 of the 2026-08-07 message-system plan.
  INFO_0090: 'MSG_INFO_0090', // Tạo chuyên khoa
  INFO_0091: 'MSG_INFO_0091', // Cập nhật chuyên khoa
  INFO_0092: 'MSG_INFO_0092', // Xóa chuyên khoa
  // INFO_0093-0096: cls-rooms.controller.ts's CRUD had no @MsgCode at all
  // (frontend hardcoded the success toast text instead) — Phase 7 of the
  // 2026-08-07 message-system plan. Separate from INFO_0021-0024 (regular
  // rooms) because those have a `{room_code}` placeholder, which the plain
  // @MsgCode decorator can't fill in (no manual response-building here) —
  // see ResponseTransformInterceptor.
  INFO_0093: 'MSG_INFO_0093', // Tạo phòng CLS
  INFO_0094: 'MSG_INFO_0094', // Cập nhật phòng CLS
  INFO_0095: 'MSG_INFO_0095', // Kích hoạt phòng CLS
  INFO_0096: 'MSG_INFO_0096', // Vô hiệu hóa phòng CLS
  // INFO_0097: version-up 0.2 plan item #7 — guest-booking email verification
  // (RequestGuestAppointmentOtpUseCase), distinct from INFO_0010 (forgot
  // password OTP) so the wording matches the booking context.
  INFO_0097: 'MSG_INFO_0097', // Gửi mã OTP xác minh đặt lịch (khách vãng lai)
  // INFO_0098: version-up 0.2 plan item #9 tình huống B — ADMIN reassigns a
  // substitute doctor onto an absent doctor's shift (ReassignScheduleDoctorUseCase).
  INFO_0098: 'MSG_INFO_0098', // Phân công bác sĩ thay thế cho ca vắng mặt
  // INFO_0099: version-up 0.2 Phase 3 — OCR pre-fill draft for CLS LAB
  // results (ExtractClsResultOcrUseCase); nothing is persisted yet, KTV
  // still reviews/edits before calling the existing PATCH :id/result.
  INFO_0099: 'MSG_INFO_0099', // Trích xuất dữ liệu OCR — vui lòng kiểm tra trước khi lưu
  // INFO_0100: payment-before-queue change (2026-08-21) — check-in no longer
  // creates the Visit/queue number by itself; ConfirmCheckInPaymentUseCase
  // does that only after the exam fee is collected.
  INFO_0100: 'MSG_INFO_0100', // Xác nhận thanh toán check-in — bệnh nhân vào hàng chờ khám
  // INFO_0101: two-step CLS result save/lock — PATCH :id/result with
  // finalize=true (distinct from INFO_0049's draft-save wording).
  INFO_0101: 'MSG_INFO_0101', // Kết thúc và xác nhận kết quả CLS

  // WARN — client-side-only validation/precondition messages (frontend
  // toasts shown before an API call is even made, so there's no backend
  // response to read a message from) — reintroduced 2026-08-07 for Phase 7
  // of the message-system plan; distinct severity from ERR (not a rejected
  // API request) and INFO (not a completed action).
  WARN_0001: 'MSG_WARN_0001', // Đăng nhập: thiếu thông tin
  WARN_0002: 'MSG_WARN_0002', // Đăng ký: thiếu thông tin
  WARN_0003: 'MSG_WARN_0003', // Thông tin không hợp lệ — tiêu đề dùng chung nhiều form (chi tiết field lỗi truyền riêng qua description)
  WARN_0004: 'MSG_WARN_0004', // Đăng ký: mật khẩu và xác nhận mật khẩu không khớp
  WARN_0005: 'MSG_WARN_0005', // Đặt lịch nhanh: thiếu thông tin bắt buộc
  WARN_0006: 'MSG_WARN_0006', // Đặt lịch nhanh: vui lòng kiểm tra lại thông tin đặt lịch
  WARN_0007: 'MSG_WARN_0007', // Vui lòng kiểm tra lại thông tin — dùng chung đặt lịch (book-appointment + receptionist tạo lịch hẹn)
  WARN_0008: 'MSG_WARN_0008', // Đổi mật khẩu: thiếu thông tin
  WARN_0009: 'MSG_WARN_0009', // Lễ tân: chưa chỉ định bác sĩ cho lịch hẹn
  WARN_0010: 'MSG_WARN_0010', // Tải ảnh đại diện/chứng chỉ lên thất bại — dùng chung admin + doctor tự cập nhật hồ sơ
  WARN_0011: 'MSG_WARN_0011', // Bệnh án: không có quyền cập nhật (không phải bác sĩ phụ trách)
  WARN_0012: 'MSG_WARN_0012', // Phòng CLS: chưa chọn chuyên môn phòng
  WARN_0013: 'MSG_WARN_0013', // Nhập kho vật tư: chưa chọn vật tư cho tất cả các dòng

  // ERR
  ERR_0002: 'MSG_ERR_0002', // Tài khoản bị khóa do đăng nhập sai
  ERR_0005: 'MSG_ERR_0005', // OTP không hợp lệ / hết hạn

  // ERR — dùng chung, ánh xạ từ HTTP status / GlobalExceptionFilter
  ERR_0006: 'MSG_ERR_0006', // VALIDATION_FAILED (400)
  ERR_0007: 'MSG_ERR_0007', // INVALID_SESSION / UNAUTHORIZED (401)
  ERR_0008: 'MSG_ERR_0008', // FORBIDDEN (403)
  ERR_0009: 'MSG_ERR_0009', // NOT_FOUND (404), param {resource}
  ERR_0010: 'MSG_ERR_0010', // CONFLICT / DUPLICATE (409)
  ERR_0011: 'MSG_ERR_0011', // INTERNAL_ERROR (500)
  ERR_0012: 'MSG_ERR_0012', // INVALID_CREDENTIALS (401, sai email/mật khẩu)
  ERR_0013: 'MSG_ERR_0013', // WEAK_PASSWORD (400, mật khẩu mới không đạt yêu cầu độ mạnh)
  ERR_0014: 'MSG_ERR_0014', // ACCOUNT_INACTIVE (403, tài khoản bị vô hiệu hóa)
  ERR_0015: 'MSG_ERR_0015', // SAME_PASSWORD (400, mật khẩu mới trùng mật khẩu cũ)
  ERR_0028: 'MSG_ERR_0028', // SERVICE_IN_USE — xóa dịch vụ đang sử dụng
  ERR_0031: 'MSG_ERR_0031', // Lịch trực bị trùng
  ERR_0032: 'MSG_ERR_0032', // Xóa lịch có lịch hẹn
  ERR_0033: 'MSG_ERR_0033', // Bác sĩ không có ca trực
  ERR_0034: 'MSG_ERR_0034', // Lý do hủy bỏ trống
  ERR_0035: 'MSG_ERR_0035', // Hủy lịch đã check-in
  ERR_0036: 'MSG_ERR_0036', // Cập nhật lịch đã check-in
  ERR_0037: 'MSG_ERR_0037', // Giờ hẹn mới bị trùng
  ERR_0038: 'MSG_ERR_0038', // Lý do từ chối bỏ trống
  ERR_0044: 'MSG_ERR_0044', // Hóa đơn đã tồn tại
  // ERR_0045: repurposed (version-up 0.2 item #10) — POST /invoices is no
  // longer the primary way an invoice gets created (that now happens
  // automatically at check-in/CLS-order/visit-completion, see
  // InvoiceBillingService), it's a fallback for appointments checked in
  // before this feature shipped. Wording changed from "appointment must be
  // COMPLETED" to "appointment must at least be checked in".
  ERR_0045: 'MSG_ERR_0045', // Tạo hóa đơn cho lịch chưa check-in
  ERR_0046: 'MSG_ERR_0046', // Tên danh mục vật tư đã tồn tại
  ERR_0047: 'MSG_ERR_0047', // Xóa danh mục đang có vật tư
  ERR_0048: 'MSG_ERR_0048', // Tên nhà cung cấp đã tồn tại
  ERR_0049: 'MSG_ERR_0049', // Tồn kho không đủ để phân phối
  ERR_0050: 'MSG_ERR_0050', // Số lượng không hợp lệ
  ERR_0051: 'MSG_ERR_0051', // Tên thuốc đã tồn tại
  ERR_0052: 'MSG_ERR_0052', // Xóa thuốc đang trong đơn
  ERR_0057: 'MSG_ERR_0057', // Dịch vụ chưa được gán chuyên khoa
  ERR_0058: 'MSG_ERR_0058', // Phòng đã được gán cho nhân viên khác cùng ca
  ERR_0059: 'MSG_ERR_0059', // Chưa có phiếu CLS nào để tạm rời phòng chờ kết quả
  ERR_0061: 'MSG_ERR_0061', // Khoảng ngày không hợp lệ (toDate < fromDate) — dùng chung cho tạo lịch làm việc hàng loạt
  ERR_0062: 'MSG_ERR_0062', // Khung giờ đặt lịch đã ở trong quá khứ
  ERR_0063: 'MSG_ERR_0063', // Chỉ được check-in đúng ngày hẹn khám
  ERR_0064: 'MSG_ERR_0064', // Phòng khám đang có bệnh nhân đang khám
  ERR_0065: 'MSG_ERR_0065', // Chưa có phiếu kết quả khám để hoàn tất
  ERR_0066: 'MSG_ERR_0066', // Mật khẩu mới và xác nhận mật khẩu không khớp
  ERR_0067: 'MSG_ERR_0067', // Xóa vật tư còn tồn kho > 0
  ERR_0068: 'MSG_ERR_0068', // Xóa vật tư đã có lịch sử giao dịch
  ERR_0069: 'MSG_ERR_0069', // Xóa nhà cung cấp còn gắn với lô vật tư đã nhập
  ERR_0070: 'MSG_ERR_0070', // Đặt lịch nhanh vào giờ nghỉ trưa
  ERR_0071: 'MSG_ERR_0071', // Dịch vụ CLS phải chọn loại phòng thực hiện (clsCategory)
  ERR_0072: 'MSG_ERR_0072', // Dịch vụ khám (EXAMINATION) không được gán loại phòng CLS
  ERR_0073: 'MSG_ERR_0073', // Dịch vụ CLS không khớp với loại phòng đã chọn khi tạo phiếu CLS
  ERR_0074: 'MSG_ERR_0074', // Dịch vụ CLS không thể dùng để đặt/sửa lịch hẹn khám
  // ERR_0075-0092: dedicated state-conflict messages, replacing the shared
  // generic MSG_ERR_0010 ("{resource} đã tồn tại hoặc bị xung đột.") which
  // rendered a literal unfilled {resource} placeholder to users, since none
  // of these call sites ever passed a `resource` param — see 2026-08-02
  // message-catalog audit.
  ERR_0075: 'MSG_ERR_0075', // Lịch hẹn chưa được xác nhận
  ERR_0076: 'MSG_ERR_0076', // Lịch hẹn không ở trạng thái chờ xác nhận
  ERR_0077: 'MSG_ERR_0077', // Bệnh nhân chưa được tiếp đón (check-in)
  ERR_0078: 'MSG_ERR_0078', // Lượt khám không ở trạng thái chờ
  ERR_0079: 'MSG_ERR_0079', // Lượt khám không ở trạng thái đang khám
  ERR_0080: 'MSG_ERR_0080', // Không thể gọi bệnh nhân ở trạng thái hiện tại
  ERR_0081: 'MSG_ERR_0081', // Không thể bắt đầu khám ở trạng thái hiện tại
  ERR_0082: 'MSG_ERR_0082', // Không thể tạm giữ lượt khám ở trạng thái hiện tại
  ERR_0083: 'MSG_ERR_0083', // Lượt khám chưa được gọi
  ERR_0084: 'MSG_ERR_0084', // Không thể in phiếu số thứ tự ở trạng thái hiện tại
  ERR_0085: 'MSG_ERR_0085', // Phiếu chỉ định CLS không ở trạng thái chờ thực hiện
  ERR_0086: 'MSG_ERR_0086', // Phiếu chỉ định CLS không ở trạng thái đang thực hiện
  ERR_0087: 'MSG_ERR_0087', // Phòng CLS đang bận
  ERR_0088: 'MSG_ERR_0088', // Lượt khám còn phiếu chỉ định CLS chưa hoàn thành
  ERR_0089: 'MSG_ERR_0089', // Kết quả khám cho lượt khám này đã tồn tại
  ERR_0090: 'MSG_ERR_0090', // Mã tra cứu đã hết hạn
  ERR_0091: 'MSG_ERR_0091', // Đơn thuốc cho lượt khám này đã tồn tại
  ERR_0092: 'MSG_ERR_0092', // Hóa đơn này đã được thanh toán
  // ERR_0093-0094: AI errors previously mis-reused ERR_0064/ERR_0065
  // (RoomBusyError / ExaminationResultRequiredError's messages), which
  // showed a completely unrelated error to the user on AI failures.
  ERR_0093: 'MSG_ERR_0093', // Dịch vụ tóm tắt AI hiện không khả dụng
  ERR_0094: 'MSG_ERR_0094', // Đã vượt giới hạn số lần gọi AI
  ERR_0095: 'MSG_ERR_0095', // Quá nhiều yêu cầu (429 chung, mọi endpoint bị throttle)

  // ERR_0096-0132: DTO validation messages (class-validator), migrated off
  // hardcoded literal strings via MessageCodeValidationPipe — see Phase 3 of
  // the 2026-08-07 message-system plan. Many of these are shared by 2+ DTOs
  // that previously duplicated the exact same literal (e.g. create/update
  // pairs) — reused here as 1 code instead of 1-per-DTO.
  ERR_0096: 'MSG_ERR_0096', // Số điện thoại cá nhân không đúng định dạng (10 số, bắt đầu bằng 0)
  ERR_0097: 'MSG_ERR_0097', // Số CCCD/CMND không đúng định dạng (12 số)
  ERR_0098: 'MSG_ERR_0098', // Định dạng tháng (availability calendar) không hợp lệ
  ERR_0099: 'MSG_ERR_0099', // Ngày sinh không được ở tương lai
  ERR_0100: 'MSG_ERR_0100', // Tên chuyên khoa bỏ trống
  ERR_0101: 'MSG_ERR_0101', // Tên chuyên khoa quá 100 ký tự
  ERR_0102: 'MSG_ERR_0102', // Ảnh đại diện bác sĩ không phải URL hợp lệ
  ERR_0103: 'MSG_ERR_0103', // Tên thuốc bỏ trống
  ERR_0104: 'MSG_ERR_0104', // Tên thuốc quá 150 ký tự
  ERR_0105: 'MSG_ERR_0105', // Hoạt chất bỏ trống
  ERR_0106: 'MSG_ERR_0106', // Hoạt chất quá 200 ký tự
  ERR_0107: 'MSG_ERR_0107', // Dạng bào chế bỏ trống
  ERR_0108: 'MSG_ERR_0108', // Dạng bào chế quá 50 ký tự
  ERR_0109: 'MSG_ERR_0109', // Đơn vị tính (MeasurementUnit) không hợp lệ — dùng chung cho thuốc + vật tư
  ERR_0110: 'MSG_ERR_0110', // Giá phải là số dương — dùng chung cho thuốc + dịch vụ
  ERR_0111: 'MSG_ERR_0111', // Tên dịch vụ bỏ trống
  ERR_0112: 'MSG_ERR_0112', // Tên dịch vụ quá 50 ký tự
  ERR_0113: 'MSG_ERR_0113', // Loại dịch vụ (ServiceType) không hợp lệ
  ERR_0114: 'MSG_ERR_0114', // Nhóm CLS (ClsRoomCategory) không hợp lệ
  ERR_0115: 'MSG_ERR_0115', // Tên nhà cung cấp bỏ trống
  ERR_0116: 'MSG_ERR_0116', // Tên nhà cung cấp quá 150 ký tự
  ERR_0117: 'MSG_ERR_0117', // SĐT nhà cung cấp không đúng định dạng
  ERR_0118: 'MSG_ERR_0118', // Email không hợp lệ — dùng chung nhiều DTO
  ERR_0119: 'MSG_ERR_0119', // Tên vật tư bỏ trống
  ERR_0120: 'MSG_ERR_0120', // Tên vật tư quá 150 ký tự
  ERR_0121: 'MSG_ERR_0121', // Chưa chọn danh mục vật tư
  ERR_0122: 'MSG_ERR_0122', // Mức tồn kho tối thiểu không được âm
  ERR_0123: 'MSG_ERR_0123', // Chưa chọn vật tư — dùng chung phân phối + nhập kho
  ERR_0124: 'MSG_ERR_0124', // Chưa chọn phòng (phân phối vật tư)
  ERR_0125: 'MSG_ERR_0125', // Giá nhập không được âm
  ERR_0126: 'MSG_ERR_0126', // Chưa chọn nhà cung cấp (nhập kho)
  ERR_0127: 'MSG_ERR_0127', // Cần ít nhất 1 dòng vật tư khi nhập kho
  ERR_0128: 'MSG_ERR_0128', // Trạng thái tồn kho (SupplyStockStatus) không hợp lệ
  ERR_0129: 'MSG_ERR_0129', // Loại giao dịch vật tư (SupplyTransactionType) không hợp lệ
  ERR_0130: 'MSG_ERR_0130', // Tên danh mục vật tư bỏ trống
  ERR_0131: 'MSG_ERR_0131', // Tên danh mục vật tư quá 100 ký tự
  ERR_0132: 'MSG_ERR_0132', // Vai trò (UserRole) không hợp lệ

  // ERR_0133-0136: Phase 4 — controller-level hardcoded throws migrated to
  // ApplicationError subclasses (see application-error.ts).
  ERR_0133: 'MSG_ERR_0133', // Loại tệp đính kèm CLS không hợp lệ (chỉ JPG/PNG/PDF)
  ERR_0134: 'MSG_ERR_0134', // Chưa chọn tệp để tải lên — dùng chung CLS + avatar
  ERR_0135: 'MSG_ERR_0135', // Chỉ được đính kèm tệp sau khi đã lưu kết quả CLS
  ERR_0136: 'MSG_ERR_0136', // Loại ảnh đại diện không hợp lệ (chỉ PNG/JPEG/WEBP/GIF)

  // ERR_0137: change-password's wrong-current-password case previously
  // reused ERR_0012 ("Email hoặc mật khẩu không đúng") — confusing wording
  // since there's no email field on that screen, only a password re-entry.
  ERR_0137: 'MSG_ERR_0137', // Mật khẩu hiện tại không đúng

  // ERR_0138-0139: version-up 0.2 plan item #7 "Chống spam đặt lịch" —
  // dedicated booking-throttle + pending-appointment-limit errors, distinct
  // from the generic ERR_0095 (429) so the frontend can show booking-specific
  // wording instead of the generic "quá nhiều yêu cầu" fallback.
  ERR_0138: 'MSG_ERR_0138', // Đặt lịch quá nhiều lần trong thời gian ngắn (rate limit)
  ERR_0139: 'MSG_ERR_0139', // Bệnh nhân đang có quá nhiều lịch hẹn chưa hoàn tất

  // ERR_0140-0141: version-up 0.2 plan item #9 tình huống B — validation for
  // ReassignScheduleDoctorUseCase's substitute doctor input.
  ERR_0140: 'MSG_ERR_0140', // Bác sĩ thay thế không hợp lệ (không phải tài khoản bác sĩ)
  ERR_0141: 'MSG_ERR_0141', // Bác sĩ thay thế phải khác bác sĩ hiện đang phụ trách ca này
  // ERR_0142: DTO validation for ReassignScheduleDoctorRequestDto.reason,
  // matching the work_schedules.absent_note VARCHAR(255) column.
  ERR_0142: 'MSG_ERR_0142', // Lý do vắng mặt tối đa 255 ký tự

  // ERR_0143-0145: version-up 0.2 plan item #10 "Tách luồng thanh toán theo
  // từng bước" — Gate #1 (StartVisitUseCase) and Gate #2
  // (CallPatientToClsUseCase) hard-block the clinical action until the
  // corresponding InvoiceItem has been collected, plus a validation error
  // for PayInvoiceRequestDto.itemIds.
  ERR_0143: 'MSG_ERR_0143', // Chưa đóng phí khám — không thể bắt đầu khám
  ERR_0144: 'MSG_ERR_0144', // Chưa đóng phí dịch vụ CLS — không thể thực hiện
  ERR_0145: 'MSG_ERR_0145', // Danh sách dòng thu tiền không hợp lệ (trống/không thuộc hóa đơn/đã thu)

  // ERR_0146: payment-before-queue change (2026-08-21) — check-in is now a
  // 2-step flow (check-in status transition, then confirm payment -> Visit/
  // queue number); ConfirmCheckInPaymentUseCase's status guard reuses the
  // existing AppointmentNotCheckedInError (ERR_0077), so only the
  // idempotency guard needs a new code.
  ERR_0146: 'MSG_ERR_0146', // Lịch hẹn này đã vào hàng chờ khám trước đó

  // ERR_0147: CLS result lock (2026-08-21) — once a ClsOrder reaches
  // COMPLETED (first PATCH :id/result call), further calls must be
  // rejected instead of silently overwriting an already-confirmed result.
  ERR_0147: 'MSG_ERR_0147', // Kết quả CLS đã được xác nhận, không thể chỉnh sửa

  // ERR_0148: cls-orders.controller.ts's :id/result-print handler used to
  // write a raw res.status(400).json({...}) instead of throwing, which
  // skipped the message catalog entirely — migrated so this case is
  // controlled through MSG codes like every other error in the app.
  ERR_0148: 'MSG_ERR_0148', // Chưa có kết quả CLS để in
} as const;

export type MessageCode = (typeof MSG)[keyof typeof MSG];

export class MessageCodeValue {
  private constructor(public readonly value: string) {}

  static create(value: string): MessageCodeValue {
    if (!/^MSG_(INFO|WARN|ERR)_\d{4}$/.test(value)) {
      throw new Error(`Invalid message code: ${value}`);
    }

    return new MessageCodeValue(value);
  }
}
