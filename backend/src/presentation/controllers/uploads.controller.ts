import { Controller, Inject, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { InvalidAvatarTypeError, NoFileUploadedError } from '../../application/errors/application-error';
import { STORAGE_PORT, StoragePort } from '../../application/ports/storage.port';
import { UserRole } from '../../domain/enums/user-role.enum';
import { Roles } from '../decorators/roles.decorator';

const ALLOWED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

@Controller('uploads')
export class UploadsController {
  constructor(@Inject(STORAGE_PORT) private readonly storage: StoragePort) {}

  @Post('avatar')
  @Roles(UserRole.DOCTOR, UserRole.ADMIN)
  @UseInterceptors(
    FileInterceptor('file', {
      // Buffered in memory, not written straight to disk — persistence is
      // delegated to StoragePort, which may be S3 or local disk depending on
      // configuration (see app.module.ts's STORAGE_PORT factory).
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
      fileFilter: (_req, file, callback) => {
        if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
          callback(new InvalidAvatarTypeError(), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  async uploadAvatar(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new NoFileUploadedError();

    return this.storage.upload({
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
      folder: 'avatars',
    });
  }
}
