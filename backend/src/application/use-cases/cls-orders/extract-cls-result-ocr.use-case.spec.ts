import { ExtractClsResultOcrUseCase } from './extract-cls-result-ocr.use-case';
import { ClsOrderNotFoundError } from '../../errors/application-error';
import { ClsOrder } from '../../../domain/entities/cls-order.entity';
import { ClsOrderStatus } from '../../../domain/enums/cls-order-status.enum';
import { OcrLine, OcrWord } from '../../../infrastructure/services/ocr.service';

function buildOrder(): ClsOrder {
  return new ClsOrder(
    'cls-order-1',
    'visit-1',
    'cls-room-1',
    'cls-service-1',
    null,
    ClsOrderStatus.IN_PROGRESS,
    new Date(),
    new Date(),
    'doctor-1',
  );
}

function buildDetailItem(order: ClsOrder) {
  return {
    order,
    serviceName: 'Xet nghiem mau',
    clsRoomName: 'Phong xet nghiem',
    clsRoomCategory: 'LAB',
    patientName: 'Nguyen Van A',
    patientCode: 'PT-0001',
    dateOfBirth: null,
    gender: 'MALE',
    doctorName: 'BS. Tran B',
    appointmentTime: new Date(),
    resultSummary: null,
    resultAttachments: [],
    resultRows: null,
    resultFindings: null,
    resultEnteredBy: null,
  };
}

function buildUseCase(options?: { order?: ClsOrder | null; text?: string; lines?: OcrLine[] }) {
  const order = options?.order === undefined ? buildOrder() : options.order;

  const clsOrderRepository = {
    findWithDetailById: jest.fn().mockResolvedValue(order ? buildDetailItem(order) : null),
  };
  const ocrService = {
    recognizeText: jest.fn().mockResolvedValue({
      text: options?.text ?? '',
      lines: options?.lines ?? [],
    }),
  };

  const useCase = new ExtractClsResultOcrUseCase(clsOrderRepository as never, ocrService as never);

  return { useCase, clsOrderRepository, ocrService };
}

// Test fixture builders for Tesseract's word-level bounding boxes — each
// word is 20px tall (a stand-in font height), with a 5px gap between words
// within the same column (normal inter-word spacing) and a 40px gap
// between columns (a printed table's column gutter), matching what
// groupIntoColumns' "gap > word height" heuristic expects to tell apart.
let cursorX = 0;
function resetCursor() {
  cursorX = 0;
}
function word(text: string, opts?: { newColumn?: boolean }): OcrWord {
  if (cursorX > 0) cursorX += opts?.newColumn ? 40 : 5;
  const x0 = cursorX;
  const x1 = x0 + text.length * 9;
  cursorX = x1;
  return { text, x0, x1, y0: 0, y1: 20 };
}
function line(...words: OcrWord[]): OcrLine {
  return { words };
}

describe('ExtractClsResultOcrUseCase', () => {
  describe('execute', () => {
    it('runs OCR and returns parsed draft rows for an existing CLS order (happy path)', async () => {
      resetCursor();
      const lines = [
        line(word('Glucose'), word('5.6', { newColumn: true }), word('mmol/L', { newColumn: true })),
      ];
      resetCursor();
      lines.push(line(word('Urea'), word('4.2', { newColumn: true }), word('mmol/L', { newColumn: true })));
      const { useCase, ocrService } = buildUseCase({ text: 'raw ocr text', lines });

      const result = await useCase.execute('cls-order-1', Buffer.from('fake-image'));

      expect(ocrService.recognizeText).toHaveBeenCalledWith(Buffer.from('fake-image'));
      expect(result.rawText).toBe('raw ocr text');
      expect(result.rows).toEqual([
        { name: 'Glucose', result: '5.6', unit: 'mmol/L' },
        { name: 'Urea', result: '4.2', unit: 'mmol/L' },
      ]);
    });

    it('rejects when the CLS order does not exist (alternative flow)', async () => {
      const { useCase, ocrService } = buildUseCase({ order: null });

      await expect(useCase.execute('missing-order', Buffer.from('x'))).rejects.toBeInstanceOf(
        ClsOrderNotFoundError,
      );
      expect(ocrService.recognizeText).not.toHaveBeenCalled();
    });
  });

  describe('parseRows (bbox-based column grouping)', () => {
    it('groups words into columns using the gap between their bounding boxes', () => {
      resetCursor();
      const lines = [line(word('Glucose'), word('5.6', { newColumn: true }), word('mmol/L', { newColumn: true }))];
      resetCursor();
      lines.push(
        line(word('Cholesterol'), word('4.1', { newColumn: true }), word('mmol/L', { newColumn: true })),
      );

      expect(ExtractClsResultOcrUseCase.parseRows(lines)).toEqual([
        { name: 'Glucose', result: '5.6', unit: 'mmol/L' },
        { name: 'Cholesterol', result: '4.1', unit: 'mmol/L' },
      ]);
    });

    it('keeps words in the same column when the gap is normal inter-word spacing', () => {
      resetCursor();
      const lines = [
        line(
          word('Ket'),
          word('luan'),
          word('Binh', { newColumn: true }),
          word('thuong'),
        ),
      ];

      expect(ExtractClsResultOcrUseCase.parseRows(lines)).toEqual([
        { name: 'Ket luan', result: 'Binh thuong' },
      ]);
    });

    it('drops a leading numeric STT column', () => {
      resetCursor();
      const lines = [
        line(
          word('1'),
          word('Glucose', { newColumn: true }),
          word('5.6', { newColumn: true }),
          word('mmol/L', { newColumn: true }),
        ),
      ];

      expect(ExtractClsResultOcrUseCase.parseRows(lines)).toEqual([
        { name: 'Glucose', result: '5.6', unit: 'mmol/L' },
      ]);
    });

    it('skips the table header row itself (Tên chỉ số / Kết quả / Đơn vị)', () => {
      resetCursor();
      const headerLine = line(
        word('Tên'),
        word('chỉ'),
        word('số'),
        word('Kết', { newColumn: true }),
        word('quả'),
        word('Đơn', { newColumn: true }),
        word('vị'),
      );
      resetCursor();
      const dataLine = line(word('Glucose'), word('5.6', { newColumn: true }), word('mmol/L', { newColumn: true }));

      expect(ExtractClsResultOcrUseCase.parseRows([headerLine, dataLine])).toEqual([
        { name: 'Glucose', result: '5.6', unit: 'mmol/L' },
      ]);
    });

    it('skips lines that never form more than one column (titles, noise)', () => {
      resetCursor();
      const titleLine = line(word('PHIẾU'), word('KẾT'), word('QUẢ'));
      resetCursor();
      const dataLine = line(word('Glucose'), word('5.6', { newColumn: true }), word('mmol/L', { newColumn: true }));

      expect(ExtractClsResultOcrUseCase.parseRows([titleLine, dataLine])).toEqual([
        { name: 'Glucose', result: '5.6', unit: 'mmol/L' },
      ]);
    });

    it('returns an empty array when no line has more than one word', () => {
      const lines = [line({ text: 'noise', x0: 0, x1: 40, y0: 0, y1: 20 })];
      expect(ExtractClsResultOcrUseCase.parseRows(lines)).toEqual([]);
    });

    it('returns an empty array for no lines at all', () => {
      expect(ExtractClsResultOcrUseCase.parseRows([])).toEqual([]);
    });
  });
});
