import { Injectable, Logger } from '@nestjs/common';
import { createWorker } from 'tesseract.js';

export interface OcrWord {
  text: string;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export interface OcrLine {
  words: OcrWord[];
}

export interface OcrResult {
  text: string;
  lines: OcrLine[];
}

// Temporary bridge for lab machines that only print paper slips (no
// HL7/ASTM integration) — see kaizen/KE_HOACH_VERSION_UP_0.2.md Phase 3.
// Runs fully on-prem (no cloud OCR API) so patient result images never
// leave the server. A fresh worker is spun up per call and terminated
// right after — simplest correct option; not optimized for throughput
// since OCR extraction here is an occasional, user-triggered action, not
// a hot path.
@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);

  async recognizeText(imageBuffer: Buffer, langs = 'vie+eng'): Promise<OcrResult> {
    const worker = await createWorker(langs);
    try {
      // `blocks: true` is required to get word-level bounding boxes —
      // Tesseract.js's default output only includes flattened `text`,
      // which collapses every run of whitespace to a single space and so
      // can never be re-split back into table columns (see
      // ExtractClsResultOcrUseCase.parseRows for why that matters).
      const {
        data: { text, blocks },
      } = await worker.recognize(imageBuffer, {}, { text: true, blocks: true });

      const lines: OcrLine[] = [];
      for (const block of blocks ?? []) {
        for (const paragraph of block.paragraphs) {
          for (const line of paragraph.lines) {
            lines.push({
              words: line.words.map((word) => ({
                text: word.text,
                x0: word.bbox.x0,
                x1: word.bbox.x1,
                y0: word.bbox.y0,
                y1: word.bbox.y1,
              })),
            });
          }
        }
      }

      return { text, lines };
    } catch (error) {
      this.logger.error(`OCR recognition failed: ${(error as Error).message}`);
      throw error;
    } finally {
      await worker.terminate();
    }
  }
}
