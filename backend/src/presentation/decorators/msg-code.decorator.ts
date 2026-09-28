import { SetMetadata } from '@nestjs/common';
import { MessageCode } from '../../domain/value-objects/message-code.vo';

export const MSG_CODE_KEY = 'MSG_CODE';

/**
 * Đặt trên controller handler để báo hiệu message code thành công.
 * ResponseTransformInterceptor sẽ resolve code này thành chuỗi ngôn ngữ tự nhiên
 * qua MessageCatalogPort và đặt vào ApiResponse.message.
 *
 * Chỉ dùng cho mutation handlers (POST / PUT / PATCH / DELETE).
 * GET handlers không cần — message mặc định là 'OK'.
 */
export const MsgCode = (code: MessageCode) => SetMetadata(MSG_CODE_KEY, code);
