import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as bwipjs from 'bwip-js';
import { formatClinicDateTime, toClinicNaiveUtc } from '../../domain/services/clinic-calendar.util';
import { ClsRoomCategory } from '../../domain/enums/cls-room-category.enum';
import { LabResultRow } from '../../domain/repositories/cls-order.repository';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit');

const FONT_CANDIDATES = [
  process.env.PDF_FONT_PATH,
  'C:/Windows/Fonts/arial.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
  '/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf',
  '/usr/share/fonts/opentype/noto/NotoSans-Regular.ttf',
].filter((path): path is string => Boolean(path));

const BOLD_FONT_CANDIDATES = [
  process.env.PDF_FONT_BOLD_PATH,
  'C:/Windows/Fonts/arialbd.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
  '/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf',
  '/usr/share/fonts/opentype/noto/NotoSans-Bold.ttf',
].filter((path): path is string => Boolean(path));

const CLINIC_NAME    = 'PHÒNG KHÁM ĐA KHOA ÂU CƠ PHÚ HÀ';
const CLINIC_ADDRESS = 'Số 38, Minh Lang, Việt Trì, Phú Thọ';
const CLINIC_PHONE   = 'Điện thoại: 0969 434 729';

// A4 page layout (margin = 50)
const PAGE_LEFT  = 50;
const PAGE_RIGHT = 545;
const PAGE_WIDTH = PAGE_RIGHT - PAGE_LEFT; // 495 pt

// Real printed slips (see spec/Phiếu/*.jpg) are plain black ink on white
// paper — no colored fills, no zebra striping, no colored callout boxes.
// Every "highlight" below is done with bold/box-border instead of color.
const BORDER = '#000000';

type Doc = {
  on(event: string, handler: (...args: any[]) => void): Doc;
  font(name: string): Doc;
  fontSize(size: number): Doc;
  text(
    text: string,
    xOrOpts?: number | Record<string, unknown>,
    yOrOpts?: number | Record<string, unknown>,
    opts?: Record<string, unknown>,
  ): Doc;
  image(src: Buffer | string, x?: number, y?: number, opts?: Record<string, unknown>): Doc;
  moveDown(lines?: number): Doc;
  moveTo(x: number, y: number): Doc;
  lineTo(x: number, y: number): Doc;
  rect(x: number, y: number, w: number, h: number): Doc;
  stroke(): Doc;
  fill(colorOrRule?: string): Doc;
  fillColor(color: string): Doc;
  strokeColor(color: string): Doc;
  lineWidth(w: number): Doc;
  addPage(): Doc;
  end(): void;
  y: number;
  registerFont(name: string, path: string): Doc;
  image(src: Buffer | string, ...args: unknown[]): Doc;
  page: { width: number; height: number };
  heightOfString(text: string, opts?: Record<string, unknown>): number;
};

@Injectable()
export class PdfService {
  private static readonly logger = new Logger(PdfService.name);
  private readonly fontPath: string;
  private readonly boldFontPath: string;
  private readonly hasCjkFont: boolean;

  constructor() {
    const found = FONT_CANDIDATES.find((p) => fs.existsSync(p));
    this.hasCjkFont = Boolean(found);
    this.fontPath = found ?? 'Helvetica';
    this.boldFontPath = this.hasCjkFont
      ? (BOLD_FONT_CANDIDATES.find((p) => fs.existsSync(p)) ?? this.fontPath)
      : 'Helvetica-Bold';

    if (!this.hasCjkFont) {
      PdfService.logger.warn(
        'No Unicode TTF font found — Vietnamese diacritics will not render. ' +
        'Install Arial or DejaVuSans.',
      );
    }
  }

  // ─── Font helpers ──────────────────────────────────────────────────────────

  private createDoc(size: 'A4' | 'A5' = 'A4'): Doc {
    return new PDFDocument({ margin: 50, size }) as Doc;
  }

  private registerFonts(doc: Doc): void {
    if (this.hasCjkFont) {
      doc.registerFont('Normal', this.fontPath);
      doc.registerFont('Bold', this.boldFontPath);
    }
  }

  private normal(doc: Doc): Doc {
    return this.hasCjkFont ? doc.font('Normal') : doc.font('Helvetica');
  }

  private bold(doc: Doc): Doc {
    return this.hasCjkFont ? doc.font('Bold') : doc.font('Helvetica-Bold');
  }

  // ─── Layout helpers ────────────────────────────────────────────────────────

  /**
   * Clinic header + document title. Must be called first on every document.
   * `geometry` lets a narrower page (e.g. the A5 queue ticket) override the
   * separator line's width — every other caller stays on A4's PAGE_LEFT/RIGHT.
   */
  private header(doc: Doc, title: string, geometry?: { left: number; right: number }): void {
    const left = geometry?.left ?? PAGE_LEFT;
    const right = geometry?.right ?? PAGE_RIGHT;

    this.bold(doc).fontSize(15).fillColor('#000000')
      .text(CLINIC_NAME, { align: 'center' });
    this.normal(doc).fontSize(9).fillColor('#000000')
      .text(CLINIC_ADDRESS, { align: 'center' });
    this.normal(doc).fontSize(9).fillColor('#000000')
      .text(CLINIC_PHONE, { align: 'center' });

    doc.moveDown(0.4);
    doc.strokeColor(BORDER).lineWidth(1)
      .moveTo(left, doc.y).lineTo(right, doc.y).stroke();
    doc.moveDown(0.5);

    this.bold(doc).fontSize(14).fillColor('#000000')
      .text(title, { align: 'center' });
    doc.moveDown(0.8);
    this.normal(doc).fillColor('#000000').fontSize(10);
  }

  /** Print a "Label: Value" line in normal font. */
  private field(doc: Doc, label: string, value: string): void {
    this.bold(doc).fontSize(10).text(`${label}: `, { continued: true });
    this.normal(doc).fontSize(10).text(value);
  }

  /** Footer separator line and disclaimer. See `header()` re: `geometry`. */
  private footer(doc: Doc, geometry?: { left: number; right: number }): void {
    const left = geometry?.left ?? PAGE_LEFT;
    const right = geometry?.right ?? PAGE_RIGHT;

    doc.moveDown(2);
    doc.strokeColor(BORDER).lineWidth(0.5)
      .moveTo(left, doc.y).lineTo(right, doc.y).stroke();
    doc.moveDown(0.4);
    // Explicit x/y (not the 2-arg text(str, opts) form) — the implicit cursor
    // position left behind by whichever absolute-positioned draw call ran
    // right before this (e.g. drawInfoTable's per-cell .text() calls) is not
    // reliable, and silently clipped this line's right edge on narrower (A5)
    // pages when it was left to default.
    this.normal(doc).fontSize(8).fillColor('#000000')
      .text(
        'Phiếu này được tạo tự động từ hệ thống quản lý — Phòng Khám Đa Khoa Âu Cơ Phú Hà',
        left, doc.y, { align: 'center', width: right - left },
      );
    doc.fillColor('#000000');
  }

  /**
   * Draw a section title as bold black text with a thin underline (no
   * colored fill — real printed slips introduce each section with plain
   * bold text, see spec/Phiếu/*.jpg). Returns the y position immediately
   * below it.
   */
  private drawSectionTitle(doc: Doc, title: string, startY?: number): number {
    const y = startY ?? doc.y;
    const H = 18;
    this.bold(doc).fontSize(9.5).fillColor('#000000')
      .text(title, PAGE_LEFT, y + 3, { width: PAGE_WIDTH, lineBreak: false });
    doc.strokeColor(BORDER).lineWidth(0.75)
      .moveTo(PAGE_LEFT, y + H - 2).lineTo(PAGE_RIGHT, y + H - 2).stroke();
    return y + H;
  }

  /**
   * Draw a 2-column key/value info table.
   * Returns the y position immediately below the table. `geometry` lets a
   * narrower page (e.g. the A5 queue ticket) override left/width — every
   * other caller stays on A4's PAGE_LEFT/PAGE_WIDTH.
   */
  private drawInfoTable(
    doc: Doc,
    rows: [string, string][],
    startY?: number,
    geometry?: { left: number; width: number; labelWidth?: number },
  ): number {
    const x       = geometry?.left ?? PAGE_LEFT;
    const width   = geometry?.width ?? PAGE_WIDTH;
    const y       = startY ?? doc.y;
    const MIN_ROW_H = 20;
    const LABEL_W = geometry?.labelWidth ?? 150;
    const VALUE_W = width - LABEL_W;
    const PAD     = 4;

    let currentY = y;
    rows.forEach(([label, value]) => {
      const textH = this.normal(doc).fontSize(9).heightOfString(value, { width: VALUE_W - PAD * 2 });
      const rh = Math.max(MIN_ROW_H, textH + PAD * 2);

      doc.strokeColor(BORDER).lineWidth(0.5).rect(x, currentY, width, rh).stroke();
      doc.strokeColor(BORDER).lineWidth(0.5)
        .moveTo(x + LABEL_W, currentY).lineTo(x + LABEL_W, currentY + rh).stroke();

      this.bold(doc).fontSize(9).fillColor('#000000')
        .text(label, x + PAD, currentY + PAD, { width: LABEL_W - PAD * 2, lineBreak: false });
      this.normal(doc).fontSize(9).fillColor('#000000')
        .text(value, x + LABEL_W + PAD, currentY + PAD, { width: VALUE_W - PAD * 2 });

      currentY += rh;
    });

    doc.fillColor('#000000');
    return currentY + 8;
  }

  /**
   * Draw a multi-column data table, header + body both plain black-on-white
   * (see spec/Phiếu/*.jpg — no colored header fill, no zebra striping).
   * `pct` is the column width as a fraction of PAGE_WIDTH; `align` (default
   * 'left') is applied to both the header and every row's cell in that
   * column — narrow numeric columns (STT, SL, ...) should pass 'center' so
   * the value lines up under its centered header instead of hugging the
   * left edge, which is what made quantity columns look misaligned.
   * Numeric-column cells are also centered vertically within the row (rows
   * grow taller when an adjacent text column wraps to multiple lines).
   * Automatically inserts page breaks and redraws the header when rows
   * would overflow the page. Returns the y position immediately below the
   * table.
   */
  private drawDataTable(
    doc: Doc,
    columns: { header: string; pct: number; align?: 'left' | 'center' | 'right' }[],
    rows: string[][],
    startY?: number,
  ): number {
    const x         = PAGE_LEFT;
    const y         = startY ?? doc.y;
    const PAGE_BOTTOM = doc.page.height - 50;
    const HDR_H     = 22;
    const MIN_ROW_H = 18;
    const PAD       = 4;
    const LINE_H    = 8.5 * 1.15; // matches pdfkit's default line-height factor at fontSize 8.5
    const widths    = columns.map((c) => Math.floor(PAGE_WIDTH * c.pct));

    const drawHeader = (atY: number): number => {
      let cx = x;
      columns.forEach((col, ci) => {
        doc.strokeColor(BORDER).lineWidth(0.5).rect(cx, atY, widths[ci], HDR_H).stroke();
        this.bold(doc).fontSize(8.5).fillColor('#000000')
          .text(col.header, cx + PAD, atY + 6, { width: widths[ci] - PAD * 2, lineBreak: false, align: col.align ?? 'center' });
        cx += widths[ci];
      });
      return atY + HDR_H;
    };

    let tableY = drawHeader(y);

    rows.forEach((row) => {
      const cellHeights = columns.map((_, ci) => {
        const textH = this.normal(doc).fontSize(8.5).heightOfString(row[ci] ?? '', { width: widths[ci] - PAD * 2 });
        return Math.max(MIN_ROW_H, textH + PAD * 2);
      });
      const rh = Math.max(...cellHeights);

      if (tableY + rh > PAGE_BOTTOM) {
        doc.addPage();
        tableY = drawHeader(doc.y);
      }

      let cx = x;
      columns.forEach((col, ci) => {
        doc.strokeColor(BORDER).lineWidth(0.5).rect(cx, tableY, widths[ci], rh).stroke();
        const align = col.align ?? 'left';
        const textY = align === 'left' ? tableY + PAD : tableY + (rh - LINE_H) / 2;
        this.normal(doc).fontSize(8.5).fillColor('#000000')
          .text(row[ci] ?? '', cx + PAD, textY, { width: widths[ci] - PAD * 2, align });
        cx += widths[ci];
      });

      tableY += rh;
    });

    doc.fillColor('#000000');
    return tableY + 8;
  }

  // ─── PDF generators ────────────────────────────────────────────────────────

  async generateCombinedClsOrderPdf(data: {
    patientName: string;
    patientCode: string;
    dateOfBirth: Date | null;
    gender: string;
    address: string | null;
    doctorName: string;
    examiningRoomName: string | null;
    examinationDate: Date;
    diagnosis: string | null;
    orders: { clsRoomName: string; serviceName: string; unitPrice: number; note: string | null }[];
  }): Promise<Buffer> {
    const genderLabel: Record<string, string> = { MALE: 'Nam', FEMALE: 'Nữ', OTHER: 'Khác' };
    const barcodeBuffer = await this.generateBarcode(data.patientCode);

    const yearOfBirth = data.dateOfBirth ? data.dateOfBirth.getUTCFullYear() : null;
    const currentYear = new Date().getUTCFullYear();
    const age = yearOfBirth != null ? currentYear - yearOfBirth : null;
    const gender = genderLabel[data.gender] ?? data.gender;

    // Group orders by room name (preserving insertion order)
    const roomGroups = new Map<string, typeof data.orders>();
    for (const order of data.orders) {
      const bucket = roomGroups.get(order.clsRoomName) ?? [];
      bucket.push(order);
      roomGroups.set(order.clsRoomName, bucket);
    }

    const ROMAN = ['I','II','III','IV','V','VI','VII','VIII','IX','X'];

    return new Promise((resolve, reject) => {
      const doc = this.createDoc();
      this.registerFonts(doc);
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      if (barcodeBuffer) {
        doc.image(barcodeBuffer, 455, 18, { width: 90 });
      }

      this.header(doc, 'PHIẾU CHỈ ĐỊNH CẬN LÂM SÀNG');

      // ── Patient info (bullet list style) ──────────────────────────────────
      const LBL_X = PAGE_LEFT;
      const LBL_W = PAGE_WIDTH;

      const nameParts: string[] = [data.patientName];
      if (yearOfBirth != null) {
        nameParts.push(`NS: ${yearOfBirth}${age != null ? ` (${age} tuổi)` : ''}`);
      }
      nameParts.push(gender);

      // "Khoa phòng" = examining room name (with doctor in parens if available)
      const khoaPhong = data.examiningRoomName
        ? `${data.examiningRoomName} (${data.doctorName})`
        : data.doctorName;

      const infoLines: [string, string][] = [
        ['Họ tên người bệnh', nameParts.join('   ')],
      ];
      if (data.address) infoLines.push(['Địa chỉ', data.address]);
      infoLines.push(['Đối tượng', 'Dịch vụ']);
      infoLines.push(['Khoa phòng', khoaPhong]);
      if (data.diagnosis) infoLines.push(['Chẩn đoán', data.diagnosis]);

      let y = doc.y;
      for (const [label, value] of infoLines) {
        this.normal(doc).fontSize(9.5).fillColor('#000000')
          .text(`- ${label}: `, LBL_X, y, { continued: true, width: LBL_W });
        this.bold(doc).fontSize(9.5).fillColor('#000000')
          .text(value, { width: LBL_W - 10 });
        y = doc.y + 2;
      }

      doc.moveDown(0.5);
      y = doc.y;

      // ── Services table ────────────────────────────────────────────────────
      const _c0 = Math.floor(PAGE_WIDTH * 0.38);
      const _c1 = Math.floor(PAGE_WIDTH * 0.10);
      const _c2 = Math.floor(PAGE_WIDTH * 0.08);
      const _c3 = Math.floor(PAGE_WIDTH * 0.20);
      const COL_W = [_c0, _c1, _c2, _c3, PAGE_WIDTH - _c0 - _c1 - _c2 - _c3];
      const COL_HEADERS = ['Tên dịch vụ', 'Đơn vị tính', 'Số lượng', 'Đơn giá', 'Ghi chú'];
      const HDR_H  = 30;
      const PAD    = 4;
      const MIN_ROW_H = 18;
      const GROUP_H = 18;
      const LINE_H = 8.5 * 1.15; // matches pdfkit's default line-height factor at fontSize 8.5

      // Table header — plain black border + bold centered text, no fill
      // (see spec/Phiếu/*.jpg — real slips never color-fill header rows).
      let cx = PAGE_LEFT;
      COL_HEADERS.forEach((hdr, ci) => {
        doc.strokeColor(BORDER).lineWidth(0.5).rect(cx, y, COL_W[ci], HDR_H).stroke();
        const hdrH = this.bold(doc).fontSize(8.5).heightOfString(hdr, { width: COL_W[ci] - PAD * 2 });
        const textY = y + (HDR_H - hdrH) / 2;
        this.bold(doc).fontSize(8.5).fillColor('#000000')
          .text(hdr, cx + PAD, textY, { width: COL_W[ci] - PAD * 2, align: 'center' });
        cx += COL_W[ci];
      });
      y += HDR_H;

      // Group rows
      let groupIdx = 0;
      roomGroups.forEach((orders, roomName) => {
        const roman = ROMAN[groupIdx] ?? String(groupIdx + 1);
        groupIdx++;

        // Group header row — bold text on plain white, no fill.
        doc.strokeColor(BORDER).lineWidth(0.5).rect(PAGE_LEFT, y, PAGE_WIDTH, GROUP_H).stroke();
        this.bold(doc).fontSize(8.5).fillColor('#000000')
          .text(`${roman}. ${roomName.toUpperCase()}`, PAGE_LEFT + PAD, y + 4, {
            width: PAGE_WIDTH - PAD * 2,
            lineBreak: false,
          });
        y += GROUP_H;

        // Service rows
        orders.forEach((order, rowIdx) => {
          const svcH = this.normal(doc).fontSize(8.5)
            .heightOfString(order.serviceName, { width: COL_W[0] - PAD * 2 - 18 });
          const noteH = order.note
            ? this.normal(doc).fontSize(8.5).heightOfString(order.note, { width: COL_W[4] - PAD * 2 })
            : 0;
          const rh = Math.max(MIN_ROW_H, Math.max(svcH, noteH) + PAD * 2);

          cx = PAGE_LEFT;
          COL_W.forEach((w) => {
            doc.strokeColor(BORDER).lineWidth(0.5).rect(cx, y, w, rh).stroke();
            cx += w;
          });

          // Service name (with row number prefix)
          this.normal(doc).fontSize(8.5).fillColor('#000000')
            .text(`${rowIdx + 1}. ${order.serviceName}`, PAGE_LEFT + PAD, y + PAD, {
              width: COL_W[0] - PAD * 2,
            });
          const shortCellY = y + (rh - LINE_H) / 2;
          this.normal(doc).fontSize(8.5).fillColor('#000000')
            .text('Lần', PAGE_LEFT + COL_W[0] + PAD, shortCellY, {
              width: COL_W[1] - PAD * 2, lineBreak: false, align: 'center',
            });
          this.normal(doc).fontSize(8.5).fillColor('#000000')
            .text('1', PAGE_LEFT + COL_W[0] + COL_W[1] + PAD, shortCellY, {
              width: COL_W[2] - PAD * 2, lineBreak: false, align: 'center',
            });
          // Đơn giá
          const priceStr = Number(order.unitPrice).toLocaleString('vi-VN') + 'đ';
          this.normal(doc).fontSize(8.5).fillColor('#000000')
            .text(priceStr, PAGE_LEFT + COL_W[0] + COL_W[1] + COL_W[2] + PAD, shortCellY, {
              width: COL_W[3] - PAD * 2, lineBreak: false, align: 'right',
            });
          // Ghi chú — truncate at 150 chars to prevent runaway content
          if (order.note) {
            const noteText = order.note.length > 150 ? order.note.slice(0, 150) + '…' : order.note;
            this.normal(doc).fontSize(8.5).fillColor('#000000')
              .text(noteText, PAGE_LEFT + COL_W[0] + COL_W[1] + COL_W[2] + COL_W[3] + PAD, y + PAD, {
                width: COL_W[4] - PAD * 2,
              });
          }

          y += rh;
        });
      });

      // ── Tổng cộng ─────────────────────────────────────────────────────────
      const total = data.orders.reduce((sum, o) => sum + Number(o.unitPrice), 0);
      const TOTAL_H = 20;
      // Label cell spans columns 0-3, value cell is column 3 (Đơn giá width)
      const labelW = COL_W[0] + COL_W[1] + COL_W[2] + COL_W[3];
      doc.strokeColor(BORDER).lineWidth(0.5).rect(PAGE_LEFT, y, labelW, TOTAL_H).stroke();
      doc.strokeColor(BORDER).lineWidth(0.5).rect(PAGE_LEFT + labelW, y, COL_W[4], TOTAL_H).stroke();
      const totalCellY = y + (TOTAL_H - LINE_H) / 2;
      this.bold(doc).fontSize(8.5).fillColor('#000000')
        .text('Tổng cộng', PAGE_LEFT + PAD, totalCellY, {
          width: labelW - PAD * 2, lineBreak: false, align: 'right',
        });
      this.bold(doc).fontSize(8.5).fillColor('#000000')
        .text(total.toLocaleString('vi-VN') + 'đ', PAGE_LEFT + labelW + PAD, totalCellY, {
          width: COL_W[4] - PAD * 2, lineBreak: false, align: 'right',
        });
      y += TOTAL_H;

      doc.fillColor('#000000');

      // ── Footer: date + signature ───────────────────────────────────────────
      // Local getters on `new Date()` read the server's own runtime timezone
      // (wrong calendar day during Vietnam's 00:00-06:59 window whenever the
      // server isn't set to Asia/Ho_Chi_Minh, e.g. a UTC cloud deployment) —
      // shift to clinic-naive-UTC first, then read UTC getters.
      const dateStr = (() => {
        const d = toClinicNaiveUtc(new Date());
        return `Ngày ${String(d.getUTCDate()).padStart(2, '0')} Tháng ${String(d.getUTCMonth() + 1).padStart(2, '0')} Năm ${d.getUTCFullYear()}`;
      })();

      const PAGE_BOTTOM = 841 - 50;
      const SIG_BLOCK_H = 80;
      if (y + 20 + SIG_BLOCK_H > PAGE_BOTTOM) {
        doc.addPage();
        y = doc.y;
      }

      y += 16;
      this.normal(doc).fontSize(9).fillColor('#000000')
        .text(dateStr, PAGE_RIGHT - 200, y, { width: 200, align: 'center' });
      y += 14;
      this.bold(doc).fontSize(9).fillColor('#000000')
        .text('BÁC SĨ CHỈ ĐỊNH', PAGE_RIGHT - 200, y, { width: 200, align: 'center' });
      y += 52;
      this.normal(doc).fontSize(8).fillColor('#000000')
        .text('(Ký và ghi rõ họ tên)', PAGE_RIGHT - 200, y, { width: 200, align: 'center' });
      y += 16;
      this.bold(doc).fontSize(9).fillColor('#000000')
        .text(data.doctorName, PAGE_RIGHT - 200, y, { width: 200, align: 'center' });

      this.footer(doc);
      doc.end();
    });
  }

  async generateClsOrderPdf(data: {
    clsOrderId: string;
    patientName: string;
    patientCode: string;
    dateOfBirth: Date | null;
    gender: string;
    doctorName: string;
    serviceName: string;
    clsRoomName: string;
    note: string | null;
    createdAt: Date;
  }): Promise<Buffer> {
    const genderLabel: Record<string, string> = { MALE: 'Nam', FEMALE: 'Nữ', OTHER: 'Khác' };
    const barcodeBuffer = await this.generateBarcode(data.clsOrderId);
    return new Promise((resolve, reject) => {
      const doc = this.createDoc();
      this.registerFonts(doc);
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      if (barcodeBuffer) {
        doc.image(barcodeBuffer, 455, 18, { width: 90 });
      }

      this.header(doc, 'PHIẾU CHỈ ĐỊNH CẬN LÂM SÀNG');

      let y = this.drawSectionTitle(doc, 'THÔNG TIN BỆNH NHÂN');
      y = this.drawInfoTable(doc, [
        ['Họ và tên bệnh nhân', data.patientName],
        ['Mã bệnh nhân',        data.patientCode],
        ['Ngày sinh',           data.dateOfBirth ? data.dateOfBirth.toLocaleDateString('vi-VN') : '—'],
        ['Giới tính',           genderLabel[data.gender] ?? '—'],
        ['Bác sĩ chỉ định',     data.doctorName],
        ['Ngày chỉ định',       formatClinicDateTime(toClinicNaiveUtc(data.createdAt))],
      ], y);

      y = this.drawSectionTitle(doc, 'NỘI DUNG CHỈ ĐỊNH', y + 6);
      y = this.drawInfoTable(doc, [
        ['Dịch vụ cận lâm sàng', data.serviceName],
        ['Phòng thực hiện',      data.clsRoomName],
        ['Ghi chú',              data.note ?? '(Không có)'],
      ], y);

      const sigY = y + 20;
      this.normal(doc).fontSize(9).fillColor('#000000')
        .text('Bác sĩ chỉ định', PAGE_LEFT + 20, sigY, { width: 160, align: 'center' });
      this.normal(doc).fontSize(9).fillColor('#000000')
        .text('Xác nhận phòng khám', PAGE_RIGHT - 180, sigY, { width: 160, align: 'center' });
      this.normal(doc).fontSize(8).fillColor('#000000')
        .text('(Ký và ghi rõ họ tên)', PAGE_LEFT + 20, sigY + 52, { width: 160, align: 'center' });
      this.normal(doc).fontSize(8).fillColor('#000000')
        .text('(Đóng dấu, ký và ghi rõ họ tên)', PAGE_RIGHT - 180, sigY + 52, { width: 160, align: 'center' });
      this.bold(doc).fontSize(9).fillColor('#000000')
        .text(data.doctorName, PAGE_LEFT + 20, sigY + 66, { width: 160, align: 'center' });

      doc.fillColor('#000000');
      this.footer(doc);
      doc.end();
    });
  }

  async generateClsResultPdf(data: {
    clsOrderId: string;
    patientName: string;
    patientCode: string;
    dateOfBirth: Date | null;
    gender: string;
    doctorName: string;
    serviceName: string;
    clsRoomName: string;
    clsRoomCategory: ClsRoomCategory | null;
    summary: string;
    resultRows: LabResultRow[] | null;
    findings: string | null;
    completedAt: Date;
    attachments: { fileName: string; buffer?: Buffer }[];
    enteredByName: string | null;
  }): Promise<Buffer> {
    const genderLabel: Record<string, string> = { MALE: 'Nam', FEMALE: 'Nữ', OTHER: 'Khác' };
    const barcodeBuffer = await this.generateBarcode(data.clsOrderId);
    return new Promise((resolve, reject) => {
      const doc = this.createDoc();
      this.registerFonts(doc);
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      if (barcodeBuffer) {
        doc.image(barcodeBuffer, 455, 18, { width: 90 });
      }

      this.header(doc, 'PHIẾU KẾT QUẢ CẬN LÂM SÀNG');

      let y = this.drawSectionTitle(doc, 'THÔNG TIN BỆNH NHÂN');
      y = this.drawInfoTable(doc, [
        ['Họ và tên bệnh nhân', data.patientName],
        ['Mã bệnh nhân',        data.patientCode],
        ['Ngày sinh',           data.dateOfBirth ? data.dateOfBirth.toLocaleDateString('vi-VN') : '—'],
        ['Giới tính',           genderLabel[data.gender] ?? '—'],
        ['Bác sĩ chỉ định',     data.doctorName],
      ], y);

      y = this.drawSectionTitle(doc, 'THÔNG TIN DỊCH VỤ', y + 6);
      y = this.drawInfoTable(doc, [
        ['Dịch vụ thực hiện', data.serviceName],
        ['Phòng thực hiện',   data.clsRoomName],
        ['Ngày thực hiện',    formatClinicDateTime(toClinicNaiveUtc(data.completedAt))],
      ], y);

      // LAB rooms show a structured value/unit/normal-range table (matches the
      // clinic's real xét nghiệm result sheet) — X-quang/Siêu âm stay free-text.
      if (data.clsRoomCategory === 'LAB' && data.resultRows && data.resultRows.length > 0) {
        y = this.drawSectionTitle(doc, 'KẾT QUẢ XÉT NGHIỆM', y + 6);
        y = this.drawDataTable(
          doc,
          [
            { header: 'Tên xét nghiệm', pct: 0.32 },
            { header: 'Kết quả',        pct: 0.16, align: 'center' },
            { header: 'Đơn vị',         pct: 0.14, align: 'center' },
            { header: 'Bình thường',    pct: 0.20, align: 'center' },
            { header: 'Ghi chú',        pct: 0.18 },
          ],
          data.resultRows.map((r) => [r.name, r.result, r.unit ?? '', r.normalRange ?? '', r.note ?? '']),
          y,
        );
        y += 6;
      }

      // X-quang/Siêu âm real slips separate a descriptive "KẾT QUẢ" (findings)
      // section from the bolded "KL" conclusion below — LAB has its own
      // structured table above instead, so this only applies when findings
      // was actually entered.
      if (data.findings) {
        y = this.drawSectionTitle(doc, 'KẾT QUẢ', y + 6);
        this.normal(doc).fontSize(9.5).fillColor('#000000')
          .text(data.findings, PAGE_LEFT, y + 6, { width: PAGE_WIDTH });
        y = doc.y + 10;
      }

      y = this.drawSectionTitle(doc, 'KẾT LUẬN', y + 6);

      // Box height must account for real text-wrapping at this width, not
      // just literal '\n' breaks in the source string — a single long
      // paragraph (summaryLines.length === 1) could still wrap onto many
      // visual lines, and the old `lines * 16` estimate under-measured it,
      // making the summary text spill out past the box border and overlap
      // whatever was drawn next (this was the "lỗi ở ô kết luận" report).
      const boxPad = 10;
      const summaryTextWidth = PAGE_WIDTH - boxPad * 2;
      const summaryTextH = this.normal(doc).fontSize(9.5).heightOfString(data.summary, { width: summaryTextWidth });
      const boxH = Math.max(60, summaryTextH + boxPad * 2);
      doc.strokeColor(BORDER).lineWidth(1).rect(PAGE_LEFT, y, PAGE_WIDTH, boxH).stroke();
      this.normal(doc).fontSize(9.5).fillColor('#000000')
        .text(data.summary, PAGE_LEFT + boxPad, y + boxPad, { width: PAGE_WIDTH - boxPad * 2 });
      y = y + boxH + 6;

      // Embed image attachments; list non-image files as text
      const imageAttachments = data.attachments.filter((a) => a.buffer);
      const otherAttachments = data.attachments.filter((a) => !a.buffer);
      const MAX_IMG_H = 260;
      const PAGE_BOTTOM = 841 - 50; // A4 height minus bottom margin

      if (imageAttachments.length > 0) {
        y = this.drawSectionTitle(doc, 'HÌNH ẢNH ĐÍNH KÈM', y + 4);
        for (const att of imageAttachments) {
          this.normal(doc).fontSize(8.5).fillColor('#000000')
            .text(att.fileName, PAGE_LEFT, y + 4, { width: PAGE_WIDTH });
          y = doc.y + 4;
          // Start a new page if image won't fit on remaining space
          if (y + MAX_IMG_H > PAGE_BOTTOM) {
            doc.addPage();
            y = doc.y;
          }
          try {
            doc.image(att.buffer!, PAGE_LEFT, y, { fit: [PAGE_WIDTH, MAX_IMG_H], align: 'center' });
            y = y + MAX_IMG_H + 10;
          } catch {
            this.bold(doc).fontSize(9).fillColor('#000000')
              .text('(Không thể hiển thị ảnh)', PAGE_LEFT, y, { width: PAGE_WIDTH });
            y = doc.y + 6;
          }
        }
      }

      if (otherAttachments.length > 0) {
        y = this.drawSectionTitle(doc, 'TÀI LIỆU ĐÍNH KÈM', y + 4);
        const rows: [string, string][] = otherAttachments.map((a, i) => [`Tệp ${i + 1}`, a.fileName]);
        y = this.drawInfoTable(doc, rows, y);
      }

      // Ensure signature block fits on current page
      const SIG_BLOCK_H = 80;
      if (y + 20 + SIG_BLOCK_H > PAGE_BOTTOM) {
        doc.addPage();
        y = doc.y;
      }

      // Signer label matches who actually signs each CLS specialty's real
      // slip: a lab result is signed by the KTV who ran it, but X-quang/Siêu
      // âm results are read and signed by a doctor of that specialty.
      const signerLabelByCategory: Record<ClsRoomCategory, string> = {
        LAB: 'Kỹ thuật viên thực hiện',
        XRAY: 'Y - Bác sĩ',
        ULTRASOUND: 'Bác sĩ siêu âm',
        ECG: 'Kỹ thuật viên điện tim',
      };
      const signerLabel = data.clsRoomCategory ? signerLabelByCategory[data.clsRoomCategory] : 'Kỹ thuật viên thực hiện';

      const sigY = y + 20;
      this.normal(doc).fontSize(9).fillColor('#000000')
        .text(signerLabel, PAGE_LEFT + 20, sigY, { width: 160, align: 'center', lineBreak: false });
      this.normal(doc).fontSize(9).fillColor('#000000')
        .text('Xác nhận phòng khám', PAGE_RIGHT - 180, sigY, { width: 160, align: 'center', lineBreak: false });
      this.normal(doc).fontSize(8).fillColor('#000000')
        .text('(Ký và ghi rõ họ tên)', PAGE_LEFT + 20, sigY + 52, { width: 160, align: 'center', lineBreak: false });
      this.normal(doc).fontSize(8).fillColor('#000000')
        .text('(Đóng dấu, ký và ghi rõ họ tên)', PAGE_RIGHT - 180, sigY + 52, { width: 160, align: 'center' });
      if (data.enteredByName) {
        this.bold(doc).fontSize(9).fillColor('#000000')
          .text(data.enteredByName, PAGE_LEFT + 20, sigY + 66, { width: 160, align: 'center', lineBreak: false });
      }
      y = sigY + 80;

      // Ultrasound results include a physical photo the patient must bring to
      // their next visit — the real sample slip ends with this reminder.
      if (data.clsRoomCategory === 'ULTRASOUND') {
        this.normal(doc).fontSize(8.5).fillColor('#000000')
          .text(
            'Xin vui lòng giữ kết quả cẩn thận dành cho lần khám sau!',
            PAGE_LEFT, y + 6, { width: PAGE_WIDTH, align: 'center' },
          );
      }

      doc.fillColor('#000000');
      this.footer(doc);
      doc.end();
    });
  }

  // Still used by ResultsController's public "look up result by access
  // code" print (Feature 20, no auth) — kept even though the doctor/
  // receptionist-facing print button that used to call this too (Feature 19)
  // was removed in favor of FE render (version-up 0.2 #8). Feature 20 is a
  // distinct, unauthenticated flow outside that item's scope.
  async generateExaminationResultPdf(data: {
    patientName: string;
    patientCode: string;
    patientDateOfBirth: Date | null;
    patientGender: string;
    patientAddress: string | null;
    doctorName: string;
    serviceName: string;
    appointmentTime: Date;
    diagnosis: string;
    clinicalNote: string | null;
    treatmentResult: string | null;
    followUpDate: Date | null;
    accessCode: string;
    clsSummaries: {
      serviceName: string;
      clsRoomCategory: string | null;
      summary: string | null;
      resultRows: { name: string; result: string; unit?: string; normalRange?: string; note?: string }[] | null;
      resultFindings: string | null;
    }[];
  }): Promise<Buffer> {
    const genderLabel: Record<string, string> = { MALE: 'Nam', FEMALE: 'Nữ', OTHER: 'Khác' };

    return new Promise((resolve, reject) => {
      const doc = this.createDoc();
      this.registerFonts(doc);
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      this.header(doc, 'PHIẾU KẾT QUẢ KHÁM BỆNH');

      // ── Patient info (bullet list style, same as CLS slip) ────────────────
      const yearOfBirth = data.patientDateOfBirth ? data.patientDateOfBirth.getUTCFullYear() : null;
      const currentYear = new Date().getUTCFullYear();
      const age = yearOfBirth != null ? currentYear - yearOfBirth : null;
      const gender = genderLabel[data.patientGender] ?? data.patientGender;

      const nameParts: string[] = [data.patientName];
      if (yearOfBirth != null) {
        nameParts.push(`NS: ${yearOfBirth}${age != null ? ` (${age} tuổi)` : ''}`);
      }
      nameParts.push(gender);

      const infoLines: [string, string][] = [
        ['Họ tên người bệnh', nameParts.join('   ')],
        ['Mã bệnh nhân', data.patientCode],
      ];
      if (data.patientAddress) infoLines.push(['Địa chỉ', data.patientAddress]);
      infoLines.push(['Đối tượng', 'Dịch vụ']);
      infoLines.push(['Bác sĩ khám', data.doctorName]);
      infoLines.push(['Dịch vụ khám', data.serviceName]);
      infoLines.push(['Ngày khám', formatClinicDateTime(data.appointmentTime)]);

      const LBL_W = PAGE_WIDTH;
      let y = doc.y;
      for (const [label, value] of infoLines) {
        this.normal(doc).fontSize(9.5).fillColor('#000000')
          .text(`- ${label}: `, PAGE_LEFT, y, { continued: true, width: LBL_W });
        this.bold(doc).fontSize(9.5).fillColor('#000000')
          .text(value, { width: LBL_W - 10 });
        y = doc.y + 2;
      }

      // ── Kết quả khám ─────────────────────────────────────────────────────
      doc.moveDown(0.5);
      y = doc.y;
      const SEC_H = 18;
      const PAD = 4;

      const drawSection = (title: string, atY: number): number => {
        this.bold(doc).fontSize(10).fillColor('#000000')
          .text(title, PAGE_LEFT, atY + 3, { width: PAGE_WIDTH, lineBreak: false });
        doc.strokeColor(BORDER).lineWidth(0.75)
          .moveTo(PAGE_LEFT, atY + SEC_H - 2).lineTo(PAGE_RIGHT, atY + SEC_H - 2).stroke();
        return atY + SEC_H;
      };

      y = drawSection('KẾT QUẢ KHÁM', y);
      y += PAD;

      const clinicalFields: [string, string][] = [
        ['Chẩn đoán', data.diagnosis],
      ];
      if (data.clinicalNote)    clinicalFields.push(['Ghi chú lâm sàng', data.clinicalNote]);
      if (data.treatmentResult) clinicalFields.push(['Kết quả điều trị', data.treatmentResult]);
      if (data.followUpDate)    clinicalFields.push(['Ngày tái khám', data.followUpDate.toLocaleDateString('vi-VN')]);

      for (const [label, value] of clinicalFields) {
        this.normal(doc).fontSize(9.5).fillColor('#000000')
          .text(`- ${label}: `, PAGE_LEFT, y, { continued: true, width: LBL_W });
        this.bold(doc).fontSize(9.5).fillColor('#000000')
          .text(value, { width: LBL_W - 10 });
        y = doc.y + 2;
      }

      // ── CLS summaries (if any) ────────────────────────────────────────────
      if (data.clsSummaries.length > 0) {
        doc.moveDown(0.4);
        y = doc.y;
        y = drawSection('KẾT QUẢ CẬN LÂM SÀNG', y);
        y = this.drawDataTable(
          doc,
          [
            { header: 'Dịch vụ CLS',       pct: 0.45 },
            { header: 'Kết quả / Kết luận', pct: 0.55 },
          ],
          data.clsSummaries.map((c) => [c.serviceName, c.summary ?? 'Chưa có kết quả']),
          y,
        );
      }

      // ── Access code + signature ───────────────────────────────────────────
      const PAGE_BOTTOM = doc.page.height - 50;
      const SIG_BLOCK_H = 80;
      const NEEDED = 16 + 28 + 20 + SIG_BLOCK_H + 20;
      if (y + NEEDED > PAGE_BOTTOM) {
        doc.addPage();
        y = doc.y;
      }

      y += 16;
      doc.strokeColor(BORDER).lineWidth(1).rect(PAGE_LEFT, y, PAGE_WIDTH, 28).stroke();
      this.bold(doc).fontSize(9).fillColor('#000000')
        .text('Mã truy cập kết quả trực tuyến: ', PAGE_LEFT + 10, y + 9, { continued: true });
      this.bold(doc).fontSize(12).fillColor('#000000')
        .text(data.accessCode, { lineBreak: false });
      doc.fillColor('#000000');
      y += 28;

      const dateStr = (() => {
        const d = toClinicNaiveUtc(new Date());
        return `Ngày ${String(d.getUTCDate()).padStart(2, '0')} Tháng ${String(d.getUTCMonth() + 1).padStart(2, '0')} Năm ${d.getUTCFullYear()}`;
      })();

      y += 16;
      this.normal(doc).fontSize(9).fillColor('#000000')
        .text(dateStr, PAGE_RIGHT - 200, y, { width: 200, align: 'center' });
      y += 14;

      const sigY = y;
      this.normal(doc).fontSize(9).fillColor('#000000')
        .text('Bác sĩ khám', PAGE_LEFT + 20, sigY, { width: 160, align: 'center', lineBreak: false });
      this.normal(doc).fontSize(8).fillColor('#000000')
        .text('(Ký và ghi rõ họ tên)', PAGE_LEFT + 20, sigY + 52, { width: 160, align: 'center', lineBreak: false });
      this.bold(doc).fontSize(9).fillColor('#000000')
        .text(data.doctorName, PAGE_LEFT + 20, sigY + 66, { width: 160, align: 'center', lineBreak: false });
      doc.fillColor('#000000');

      this.footer(doc);
      doc.end();
    });
  }

  // Feature: "Phieu kham benh" admission slip, printed right after check-in
  // (parallel to the queue ticket). Self-pay clinic only — no BHYT/insurance
  // fields anywhere on this slip.
  async generateExaminationAdmissionPdf(data: {
    roomName: string;
    queueNumber: string | null;
    patientName: string;
    patientAddress: string | null;
    patientCode: string;
    patientDateOfBirth: Date;
    checkedInAt: Date;
    receptionistName: string;
  }): Promise<Buffer> {
    const barcodeBuffer = await this.generateBarcode(data.patientCode);

    return new Promise((resolve, reject) => {
      // A5 (per user request) — this is the only slip printed at check-in
      // (already includes STT, see business-rule comment on the controller
      // route), so it takes over the smaller ticket-like format a dedicated
      // queue-ticket PDF used to have. Its usable width is much narrower than
      // A4's PAGE_WIDTH, so geometry is computed from the actual A5 page
      // instead of using the shared A4 module constants.
      const doc = this.createDoc('A5');
      this.registerFonts(doc);
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const slipLeft = 40;
      const slipRight = doc.page.width - 40;
      const slipWidth = slipRight - slipLeft;
      const geometry = { left: slipLeft, right: slipRight };

      if (barcodeBuffer) {
        // Top-right corner, above where header()'s centered clinic name/
        // address text starts — width sized down to fit A5's narrower page.
        doc.image(barcodeBuffer, slipRight - 70, 18, { width: 70 });
      }

      this.header(doc, 'PHIẾU KHÁM BỆNH', geometry);

      // STT block — centered, no background
      const sttNum = this.formatQueueNumberForSlip(data.queueNumber);
      const lineY = doc.y;
      doc.strokeColor(BORDER).lineWidth(0.5)
        .moveTo(slipLeft, lineY).lineTo(slipRight, lineY).stroke();
      doc.moveDown(0.4);
      this.normal(doc).fontSize(9).fillColor('#000000')
        .text('SỐ THỨ TỰ', slipLeft, doc.y, { width: slipWidth, align: 'center' });
      this.bold(doc).fontSize(46).fillColor('#000000')
        .text(sttNum, slipLeft, doc.y + 2, { width: slipWidth, align: 'center' });
      doc.moveDown(0.4);
      doc.strokeColor(BORDER).lineWidth(0.5)
        .moveTo(slipLeft, doc.y).lineTo(slipRight, doc.y).stroke();
      doc.moveDown(0.5);
      this.normal(doc).fillColor('#000000').fontSize(10);

      this.drawInfoTable(
        doc,
        [
          ['Phòng khám',       data.roomName],
          ['Họ tên người bệnh', data.patientName],
          ['Địa chỉ',          data.patientAddress ?? ''],
          ['Mã BN - Ngày sinh', `${data.patientCode} - ${data.patientDateOfBirth.toLocaleDateString('vi-VN')}`],
          ['Đối tượng',        'Dịch vụ'],
          // checkedInAt is a real-UTC timestamp (check-in-appointment.use-case.ts
          // sets it via `new Date()`), not clinic-naive-UTC like appointmentTime —
          // must convert before formatExaminationDateTime's getUTC*() read, or
          // the printed time is 7h behind the real Vietnam check-in time.
          ['Khám ngày',        this.formatExaminationDateTime(toClinicNaiveUtc(data.checkedInAt))],
          ['Nhân viên',        data.receptionistName],
        ],
        undefined,
        { left: slipLeft, width: slipWidth, labelWidth: 110 },
      );
      this.footer(doc, geometry);
      doc.end();
    });
  }

  // "HH giờ mm phút, Ngày dd tháng MM năm yyyy" — Vietnamese long-form
  // date/time, matches the wording on the physical admission-slip sample.
  // appointmentTime is stored as clinic-naive-UTC (see clinic-calendar.util.ts
  // — the UTC getters already yield the correct Vietnam wall-clock value), so
  // getUTC*() is used here rather than the local-timezone getters/
  // toLocaleString() used elsewhere in this file, to stay correct regardless
  // of the server's own timezone.
  private formatExaminationDateTime(date: Date): string {
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const year = date.getUTCFullYear();
    return `${hours} giờ ${minutes} phút, Ngày ${day} tháng ${month} năm ${year}`;
  }

  // The physical sample slip shows a bare sequential number ("STT: 6"), but
  // this system's queueNumber is a composite "<roomCode>-<seq>" string (e.g.
  // "PK01-042", see prisma-appointment.repository.ts formatQueueNumber) —
  // strip the room-code prefix and leading zeros so the printed slip matches
  // the sample's plain-number look while the underlying queueNumber (used
  // for actual queue lookups/announcements) stays unchanged.
  private formatQueueNumberForSlip(queueNumber: string | null): string {
    if (!queueNumber) return '-';
    const trailingDigits = /(\d+)$/.exec(queueNumber)?.[1];
    if (!trailingDigits) return queueNumber;
    return trailingDigits;
  }

  private async generateBarcode(text: string): Promise<Buffer | null> {
    try {
      return await bwipjs.toBuffer({
        bcid: 'code128',
        text,
        scale: 2,
        height: 12,
        includetext: true,
        textxalign: 'center',
      });
    } catch (error) {
      PdfService.logger.warn(`Failed to render barcode for "${text}": ${(error as Error).message}`);
      return null;
    }
  }

}
