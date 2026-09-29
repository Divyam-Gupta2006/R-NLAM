import { Body, Controller, Inject, Injectable, Logger, Module, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsIn, IsString, MaxLength } from 'class-validator';

export const LANGUAGES = ['en', 'hi', 'mr'] as const;
export type Language = (typeof LANGUAGES)[number];

export interface TranslationResult {
  texts: string[];
  translated: boolean; // false: the originals are returned unchanged
  provider: string;
  machine: boolean; // true when a machine translated it (show a notice)
}

/**
 * Machine translation of free text (hearing outcomes, officers' replies,
 * entitlement descriptions). The citizen portal's own wording is translated
 * by hand in the frontend dictionaries; this is only for dynamic text.
 *
 * Default: no translation (originals returned, marked untranslated). A
 * Bhashini / IndicTrans2 provider plugs in behind the same interface.
 */
export interface TranslationProvider {
  readonly name: string;
  translate(texts: string[], source: Language, target: Language): Promise<TranslationResult>;
}

export const TRANSLATION_PROVIDER = Symbol('TRANSLATION_PROVIDER');

@Injectable()
export class NoTranslationProvider implements TranslationProvider {
  readonly name = 'none';
  async translate(texts: string[], source: Language, target: Language): Promise<TranslationResult> {
    return { texts, translated: source === target, provider: this.name, machine: false };
  }
}

/**
 * Bhashini (ULCA pipeline) provider: stub. Needs BHASHINI_USER_ID,
 * BHASHINI_API_KEY and a pipeline id from bhashini.gov.in (see MORNING_REPORT,
 * "Needs Parvati"). Until configured it falls back to returning originals.
 */
@Injectable()
export class BhashiniTranslationProvider implements TranslationProvider {
  readonly name = 'bhashini';
  private readonly log = new Logger(BhashiniTranslationProvider.name);
  private readonly fallback = new NoTranslationProvider();
  get configured() {
    return !!(process.env.BHASHINI_USER_ID && process.env.BHASHINI_API_KEY && process.env.BHASHINI_PIPELINE_ID);
  }
  async translate(texts: string[], source: Language, target: Language): Promise<TranslationResult> {
    if (!this.configured) return this.fallback.translate(texts, source, target);
    // Integration point: POST the pipeline's /compute endpoint with
    // taskType "translation", sourceLanguage/targetLanguage and `texts`.
    this.log.warn('Bhashini credentials are set but the client is not implemented yet; returning originals');
    return this.fallback.translate(texts, source, target);
  }
}

class TranslateDto {
  @ApiProperty({ type: [String], example: ['Hearing adjourned to next week.'] })
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(2000, { each: true })
  texts: string[];
  @ApiProperty({ enum: LANGUAGES }) @IsIn(LANGUAGES) source: Language;
  @ApiProperty({ enum: LANGUAGES }) @IsIn(LANGUAGES) target: Language;
}

@ApiTags('i18n')
@ApiBearerAuth()
@Controller('i18n')
export class TranslationController {
  constructor(@Inject(TRANSLATION_PROVIDER) private readonly provider: TranslationProvider) {}

  @Post('translate')
  @ApiOperation({ summary: 'Translate free text between English, Hindi and Marathi through the configured provider (default: none; originals returned and marked)' })
  translate(@Body() dto: TranslateDto) {
    return this.provider.translate(dto.texts, dto.source, dto.target);
  }
}

@Module({
  controllers: [TranslationController],
  providers: [{ provide: TRANSLATION_PROVIDER, useFactory: () => (process.env.TRANSLATION_PROVIDER === 'bhashini' ? new BhashiniTranslationProvider() : new NoTranslationProvider()) }],
  exports: [TRANSLATION_PROVIDER],
})
export class TranslationModule {}
