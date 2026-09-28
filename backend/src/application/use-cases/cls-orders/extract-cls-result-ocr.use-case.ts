import { Inject, Injectable } from '@nestjs/common';
import { ClsOrderNotFoundError } from '../../errors/application-error';
import {
  CLS_ORDER_REPOSITORY,
  ClsOrderRepository,
  LabResultRow,
} from '../../../domain/repositories/cls-order.repository';
import { OcrLine, OcrService, OcrWord } from '../../../infrastructure/services/ocr.service';

export interface ExtractClsResultOcrOutput {
  rawText: string;
  rows: LabResultRow[];
}

// Header labels printed on real lab-machine slips (STT / Tên chỉ số / Kết
// quả / Đơn vị / Khoảng tham chiếu) — the table-header line itself always
// OCRs into a row shape too, so it must be dropped or the draft table would
// start with a bogus "row" repeating the column titles. Matched after
// stripping diacritics/whitespace so OCR noise in accents doesn't matter.
const HEADER_TOKENS = new Set([
  'stt',
  'tenchiso',
  'tenxetnghiem',
  'chiso',
  'ketqua',
  'giatri',
  'donvi',
  'thamchieu',
  'khoangthamchieu',
  'giatribinhthuong',
  'ghichu',
]);

@Injectable()
export class ExtractClsResultOcrUseCase {
  constructor(
    @Inject(CLS_ORDER_REPOSITORY) private readonly clsOrderRepository: ClsOrderRepository,
    private readonly ocrService: OcrService,
  ) {}

  async execute(clsOrderId: string, imageBuffer: Buffer): Promise<ExtractClsResultOcrOutput> {
    const item = await this.clsOrderRepository.findWithDetailById(clsOrderId);
    if (!item) throw new ClsOrderNotFoundError();

    const { text: rawText, lines } = await this.ocrService.recognizeText(imageBuffer);
    const rows = ExtractClsResultOcrUseCase.parseRows(lines);

    return { rawText, rows };
  }

  // Heuristic parse of a lab-machine printout: one result per line, columns
  // separated by a wide gap on the printed slip — `<tên chỉ số>  <giá trị>
  // <đơn vị>`. Reference range isn't on the printed image, so it's left
  // unset for the KTV to fill in by hand (see enter-cls-result.dto.ts's
  // LabResultRowDto).
  //
  // This takes Tesseract's word-level bounding boxes, not its flattened
  // `text` string: Tesseract.js's plain-text output collapses every run of
  // whitespace down to a single space, so a printed table's column gaps
  // cannot be recovered by re-splitting that text — the only place the gap
  // width still exists is each word's own pixel position.
  static parseRows(lines: OcrLine[]): LabResultRow[] {
    const rows: LabResultRow[] = [];

    for (const line of lines) {
      const words = line.words.filter((word) => word.text.trim().length > 0);
      if (words.length < 2) continue;

      let columns = ExtractClsResultOcrUseCase.groupIntoColumns(words)
        .map((col) => col.trim())
        .filter((col) => col.length > 0);
      if (columns.length < 2) continue;

      // Drop a leading pure-numeric STT column ("1", "2.", "12)") when
      // there are still enough columns left for name/result.
      if (columns.length >= 3 && /^\d+[.)]?$/.test(columns[0])) {
        columns = columns.slice(1);
      }
      if (columns.length < 2) continue;

      const [name, result, ...rest] = columns;
      if (HEADER_TOKENS.has(this.normalizeHeaderToken(name))) continue;

      const unit = rest.length > 0 ? rest.join(' ') : undefined;
      rows.push({ name, result, ...(unit ? { unit } : {}) });
    }

    return rows;
  }

  // A gap between two consecutive words on the same line counts as a
  // column break once it's wider than either word's own text height — a
  // normal inter-word space (within "Tên chỉ số" or "(WBC)") is a small
  // fraction of the font's height, while a table's column gutter is
  // typically a full character width or more.
  private static groupIntoColumns(words: OcrWord[]): string[] {
    const sorted = [...words].sort((a, b) => a.x0 - b.x0);
    const columns: string[] = [];
    let current = sorted[0].text;
    let prevX1 = sorted[0].x1;

    for (let i = 1; i < sorted.length; i++) {
      const word = sorted[i];
      const gap = word.x0 - prevX1;
      const threshold = Math.max(sorted[i - 1].y1 - sorted[i - 1].y0, word.y1 - word.y0) * 1.6;
      if (gap > threshold) {
        columns.push(current);
        current = word.text;
      } else {
        current += ` ${word.text}`;
      }
      prevX1 = word.x1;
    }
    columns.push(current);
    return columns;
  }

  private static normalizeHeaderToken(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/đ/gi, 'd')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }
}
