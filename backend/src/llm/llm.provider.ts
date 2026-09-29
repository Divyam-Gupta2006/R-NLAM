import { Injectable, Logger } from '@nestjs/common';

/**
 * Language models may only *rephrase*. Scores, amounts, dates, owners and
 * decisions are computed without them. Every output is labelled with its
 * provider, and AI output is rejected if it drops or alters any number, date
 * or section citation from the source text.
 */
export interface RephraseResult {
  text: string;
  language: string;
  provider: string;
  model: string | null;
  aiGenerated: boolean;
  note?: string;
}

export interface LLMProvider {
  readonly name: string;
  rephrase(text: string, opts: { language: 'en' | 'hi' | 'mr'; audience: 'officer' | 'citizen' }): Promise<RephraseResult>;
}

export const LLM_PROVIDER = Symbol('LLM_PROVIDER');

/** Tokens that must survive any rephrasing: amounts, dates, numbers, section refs. */
export function protectedTokens(text: string): string[] {
  const re = /₹[\d,]+(?:\.\d+)?|\d{1,2} [A-Z][a-z]{2} \d{4}|\d{4}-\d{2}-\d{2}|s\.\s?\d+[A-Z]?(?:\(\d+\))?|\d+(?:[.,]\d+)*%?/g;
  return [...new Set(text.match(re) ?? [])];
}

export function preservesFacts(source: string, output: string): { ok: boolean; missing: string[] } {
  const normalise = (s: string) => s.replace(/\s+/g, ' ');
  const out = normalise(output);
  const missing = protectedTokens(source).filter((t) => !out.includes(normalise(t)));
  return { ok: missing.length === 0, missing };
}

/**
 * Default (LLM_PROVIDER=template): no model. Returns the deterministic brief,
 * which is already written in plain language. It does not translate.
 */
@Injectable()
export class TemplateProvider implements LLMProvider {
  readonly name = 'template';

  async rephrase(text: string, opts: { language: 'en' | 'hi' | 'mr'; audience?: 'officer' | 'citizen' }): Promise<RephraseResult> {
    if (opts.language !== 'en') {
      return {
        text,
        language: 'en',
        provider: this.name,
        model: null,
        aiGenerated: false,
        note: 'Translation needs a language model or Bhashini/IndicTrans2 (not configured); showing the English brief.',
      };
    }
    return { text, language: 'en', provider: this.name, model: null, aiGenerated: false };
  }
}

/**
 * LLM_PROVIDER=openai-compatible: any server speaking the OpenAI chat API,
 * e.g. Ollama or llama.cpp serving Llama-3.1-8B on a bigger machine.
 * LLM_BASE_URL (e.g. http://localhost:11434/v1), LLM_MODEL, optional LLM_API_KEY.
 */
@Injectable()
export class OpenAICompatibleProvider implements LLMProvider {
  readonly name = 'openai-compatible';
  private readonly logger = new Logger('LLM');
  private readonly baseUrl = process.env.LLM_BASE_URL ?? '';
  private readonly model = process.env.LLM_MODEL ?? 'llama3.1:8b';

  constructor(private readonly fallback: TemplateProvider) {}

  async rephrase(text: string, opts: { language: 'en' | 'hi' | 'mr'; audience: 'officer' | 'citizen' }): Promise<RephraseResult> {
    if (!this.baseUrl) return { ...(await this.fallback.rephrase(text, opts)), note: 'LLM_BASE_URL not set; showing the template brief.' };
    const lang = { en: 'English', hi: 'Hindi', mr: 'Marathi' }[opts.language];
    const system =
      `Rewrite the text in plain ${lang} for a ${opts.audience === 'citizen' ? 'first-time smartphone user' : 'district revenue officer'}. ` +
      'Do not add facts. Keep every number, rupee amount, date and section reference exactly as written. Output only the rewritten text.';
    try {
      const res = await fetch(`${this.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(process.env.LLM_API_KEY ? { Authorization: `Bearer ${process.env.LLM_API_KEY}` } : {}) },
        body: JSON.stringify({ model: this.model, temperature: 0.2, messages: [{ role: 'system', content: system }, { role: 'user', content: text }] }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const out = body.choices?.[0]?.message?.content?.trim();
      if (!out) throw new Error('empty completion');
      const check = preservesFacts(text, out);
      if (!check.ok) {
        return { ...(await this.fallback.rephrase(text, { language: 'en' })), note: `AI rephrasing rejected: it altered or dropped ${check.missing.slice(0, 5).join(', ')}.` };
      }
      return { text: out, language: opts.language, provider: this.name, model: this.model, aiGenerated: true };
    } catch (err) {
      this.logger.warn(`LLM rephrase failed: ${(err as Error).message}`);
      return { ...(await this.fallback.rephrase(text, { language: 'en' })), note: `LLM unavailable (${(err as Error).message}); showing the template brief.` };
    }
  }
}
