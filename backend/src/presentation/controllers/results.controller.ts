import { Controller, Get, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { Public } from '../decorators/public.decorator';
import { GetResultByCodeUseCase } from '../../application/use-cases/visits/get-result-by-code.use-case';
import { PdfService } from '../../infrastructure/services/pdf.service';

@Controller('results')
export class ResultsController {
  constructor(
    private readonly getResultByCodeUseCase: GetResultByCodeUseCase,
    private readonly pdfService: PdfService,
  ) {}

  // Feature 20 — Look up exam result by access code (no auth required)
  @Get()
  @Public()
  getByCode(@Query('code') code: string) {
    return this.getResultByCodeUseCase.execute(code);
  }

  // Feature 20 — Print result PDF by access code (no auth required)
  @Get('print')
  @Public()
  async printByCode(@Query('code') code: string, @Res() res: Response) {
    const data = await this.getResultByCodeUseCase.execute(code);
    const pdf = await this.pdfService.generateExaminationResultPdf(data);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="result-${code}.pdf"`,
      'Content-Length': pdf.length,
    });
    res.send(pdf);
  }
}
