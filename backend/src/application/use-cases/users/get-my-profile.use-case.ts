// ============================================================================
// GetMyProfileUseCase — "Xem hồ sơ cá nhân của chính mình"
// ----------------------------------------------------------------------------
// Đây là logic nghiệp vụ (business logic) xử lý khi người dùng bấm "Xem hồ sơ
// cá nhân" trên giao diện. Toàn bộ luồng: người dùng bấm nút -> Frontend gọi
// API GET /users/me -> UsersController nhận request -> gọi tới đây (use case
// này) -> use case này đi hỏi database (qua Repository) -> trả kết quả ngược
// lại cho Controller -> Controller trả JSON cho Frontend -> Frontend hiển thị
// lên màn hình.
//
// "Use case" nghĩa là 1 nghiệp vụ cụ thể của hệ thống, ở đây là nghiệp vụ
// "lấy thông tin hồ sơ của người đang đăng nhập".
// ============================================================================
import { Inject, Injectable } from '@nestjs/common';
import { USER_REPOSITORY, UserRepository } from '../../../domain/repositories/user.repository';
import { PATIENT_REPOSITORY, PatientRepository } from '../../../domain/repositories/patient.repository';
import { ResourceNotFoundError } from '../../errors/application-error';
import { UserProfileResponseDto } from '../../dtos/users/user-profile.dto';
import { UserRole } from '../../../domain/enums/user-role.enum';

@Injectable()
export class GetMyProfileUseCase {
  constructor(
    // "Repository" là lớp trung gian chuyên đọc/ghi dữ liệu vào database —
    // use case không tự viết câu lệnh truy vấn database, mà nhờ Repository làm hộ.
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(PATIENT_REPOSITORY) private readonly patientRepository: PatientRepository,
  ) {}

  // userId: mã định danh của người đang đăng nhập, được lấy sẵn từ token đăng
  // nhập (JWT) ở tầng Controller trước khi gọi vào đây — không phải do người
  // dùng tự nhập, nên không thể xem hồ sơ của người khác bằng cách sửa link.
  async execute(userId: string): Promise<UserProfileResponseDto> {
    // Bước 1: Tìm tài khoản người dùng trong bảng "users" theo userId.
    const user = await this.userRepository.findById(userId);

    // Bước 2: Nếu không tìm thấy tài khoản (trường hợp hiếm, ví dụ tài khoản
    // vừa bị xóa) -> báo lỗi "Không tìm thấy" (404) để Frontend hiển thị
    // thông báo lỗi cho người dùng, dừng xử lý tại đây.
    if (!user) throw new ResourceNotFoundError('User');

    // Bước 3: Xử lý riêng cho số CCCD/CMND (idCard).
    // Lý do có bước riêng này: cấu trúc database lưu số CCCD/CMND ở 2 chỗ
    // khác nhau tùy loại tài khoản:
    //   - Tài khoản NHÂN VIÊN (bác sĩ, lễ tân, admin...): số CCCD/CMND lưu
    //     trực tiếp trên chính bảng "users".
    //   - Tài khoản BỆNH NHÂN: số CCCD/CMND lưu ở bảng "patients" (hồ sơ
    //     bệnh nhân) riêng, có liên kết tới bảng "users" — nên phải hỏi thêm
    //     bảng "patients" mới lấy được.
    // Vì vậy: nếu là bệnh nhân (role = PATIENT) thì đi tìm thêm ở bảng
    // patients; nếu là nhân viên thì lấy luôn từ "users" cho nhanh, không
    // cần hỏi thêm.
    const idCard =
      user.role === UserRole.PATIENT
        ? (await this.patientRepository.findByUserId(user.id))?.idCard ?? null
        : user.idCard;

    // Bước 4: Đóng gói lại thành dữ liệu trả về cho Frontend — chỉ chọn lọc
    // những trường thông tin an toàn để hiển thị (không trả về mật khẩu hay
    // dữ liệu nhạy cảm khác không cần thiết).
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      idCard,
      role: user.role,
      // mustChangePassword: cờ báo "bắt buộc đổi mật khẩu" (ví dụ tài khoản
      // mới tạo dùng mật khẩu mặc định) — Frontend dựa vào đây để nhắc người
      // dùng đổi mật khẩu nếu cần.
      mustChangePassword: user.mustChangePassword,
      createdAt: user.createdAt,
    };
  }
}
