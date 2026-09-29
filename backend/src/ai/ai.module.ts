import { Body, Controller, HttpException, Injectable, Logger, Module, Post, ServiceUnavailableException, UnprocessableEntityException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';
import { R } from '../auth/auth.types';
import { Roles } from '../auth/decorators';

export interface ProposedField {
  value: string | number;
  confidence: number;
  evidence: string;
  needs_review: boolean;
}

export interface AiExtraction {
  document_type: string;
  document_type_confidence: number;
  fields: Record<string, ProposedField[]>;
  needs_review: boolean;
  text_method: string;
  characters: number;
  review_threshold: number;
}

/**
 * Talks to the FastAPI ai-service (AI_SERVICE_URL, default
 * http://localhost:8000/api/v1). When it is not running, callers get a 503
 * that says so; nothing is ever made up in its place.
 */
@Injectable()
export class AiClient {
  private readonly log = new Logger(AiClient.name);
  get baseUrl(): string {
    return (process.env.AI_SERVICE_URL ?? 'http://localhost:8000/api/v1').replace(/\/$/, '');
  }

  private async call<T>(path: string, init: RequestInit, timeoutMs = 20_000): Promise<T> {
    let res: Response;
    try {
      res = await fetch(this.baseUrl + path, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    } catch (e) {
      this.log.warn(`ai-service unreachable at ${this.baseUrl}: ${(e as Error).message}`);
      throw new ServiceUnavailableException('The AI service is not running. Start it from ai-service with `.venv/Scripts/python -m uvicorn app.main:app --port 8000` and try again.');
    }
    const body = await res.json().catch(() => ({}));
    if (res.status === 422) throw new UnprocessableEntityException(typeof body?.detail === 'string' ? body.detail : 'The AI service could not read this input');
    if (!res.ok) throw new HttpException(`AI service error (${res.status})`, 502);
    return body as T;
  }

  extract(file: Buffer, fileName: string, mimeType: string): Promise<AiExtraction> {
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(file)], { type: mimeType }), fileName);
    return this.call<AiExtraction>('/documents/extract', { method: 'POST', body: form });
  }

  ask(question: string): Promise<unknown> {
    return this.call('/legal/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question }) });
  }
}

class AskDto {
  @ApiProperty({ example: 'Within how many days can a person object after the preliminary notification?' })
  @IsString()
  @Length(5, 500)
  question: string;
}

@ApiTags('legal')
@ApiBearerAuth()
@Roles(...R.OFFICIALS)
@Controller('legal')
export class LegalController {
  constructor(private readonly ai: AiClient) {}

  @Post('ask')
  @ApiOperation({
    summary: 'Ask the RFCTLARR Act 2013 (and R-NLAM rule packs) a question; answers quote the source with a section citation, or refuse',
  })
  ask(@Body() dto: AskDto) {
    return this.ai.ask(dto.question);
  }
}

@Module({ controllers: [LegalController], providers: [AiClient], exports: [AiClient] })
export class AiModule {}
