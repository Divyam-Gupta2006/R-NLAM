import { INestApplication } from '@nestjs/common';
import * as http from 'http';
import { AddressInfo } from 'net';
import request = require('supertest');
import { createApp } from '../src/main';
import { PrismaService } from '../src/prisma/prisma.service';
import { resetDemo } from './reset';

/**
 * 6.8: the backend proxies a stored document to the AI service, stores the
 * proposal, and only a person's review (audited) turns it into confirmed
 * values. The AI service is stubbed here with the shape it really returns
 * (its extraction logic is tested in ai-service/tests); a dead URL gives 503.
 */
describe('Document AI (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let stub: http.Server;
  let received: { path?: string; bytes?: number; contentType?: string } = {};
  let token = '';
  const as = () => ({ Authorization: `Bearer ${token}` });

  const proposal = {
    document_type: 'AWARD',
    document_type_confidence: 0.85,
    text_method: 'pdf-text-layer',
    needs_review: true,
    characters: 600,
    review_threshold: 0.8,
    fields: {
      survey_numbers: [{ value: '441/3', confidence: 0.92, evidence: 'Survey No. 441/3', needs_review: false }],
      village: [{ value: 'Borgaon', confidence: 0.85, evidence: 'Village: Borgaon', needs_review: false }],
      reference_number: [{ value: 'AWD/MH-WRD/2026/0029', confidence: 0.75, evidence: 'Reference: AWD/MH-WRD/2026/0029', needs_review: true }],
    },
  };

  beforeAll(async () => {
    stub = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        received = { path: req.url, bytes: Buffer.concat(chunks).length, contentType: req.headers['content-type'] };
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(req.url?.endsWith('/legal/ask') ? { answered: true, citation: 'RFCTLARR 2013, s.30(1)', passages: [] } : proposal));
      });
    });
    await new Promise<void>((r) => stub.listen(0, '127.0.0.1', r));
    process.env.AI_SERVICE_URL = `http://127.0.0.1:${(stub.address() as AddressInfo).port}/api/v1`;

    app = await createApp();
    await app.init();
    await resetDemo(app);
    prisma = app.get(PrismaService);
    token = (await request(app.getHttpServer()).post('/api/auth/dev-login').send({ email: 'collector.wardha@demo.rnlam.in' }).expect(200)).body.token;
  });

  afterAll(async () => {
    await app.close();
    await new Promise((r) => stub.close(r));
    delete process.env.AI_SERVICE_URL;
  });

  const awardCopy = () => prisma.document.findFirstOrThrow({ where: { kind: 'AWARD_COPY', parcel: { parcelNumber: 'WRD-BRG-006' } } });

  it('returns 503 with a clear message when the AI service is down', async () => {
    const doc = await awardCopy();
    const saved = process.env.AI_SERVICE_URL;
    process.env.AI_SERVICE_URL = 'http://127.0.0.1:9/api/v1';
    const res = await request(app.getHttpServer()).post(`/api/documents/${doc.id}/extract`).set(as()).expect(503);
    process.env.AI_SERVICE_URL = saved;
    expect(res.body.message).toMatch(/AI service is not running/);
    expect(await prisma.documentExtraction.count({ where: { documentId: doc.id } })).toBe(0);
  });

  it('sends the stored file, stores the proposal and audits it', async () => {
    const doc = await awardCopy();
    const res = await request(app.getHttpServer()).post(`/api/documents/${doc.id}/extract`).set(as()).expect(201);
    expect(received.path).toBe('/api/v1/documents/extract');
    expect(received.contentType).toMatch(/multipart\/form-data/);
    expect(received.bytes).toBeGreaterThan(doc.sizeBytes);
    expect(res.body).toMatchObject({ status: 'PENDING_REVIEW', documentType: 'AWARD', documentSha256: doc.sha256, needsReview: true });
    const audit = await prisma.auditEvent.findFirstOrThrow({ where: { action: 'DOCUMENT_EXTRACTION_PROPOSED', entityId: doc.id } });
    expect(audit.newState).toMatchObject({ fieldsNeedingReview: ['reference_number'] });
  });

  it('refuses a confirmation that skips a flagged field, then records corrections', async () => {
    const doc = await awardCopy();
    const [ex] = (await request(app.getHttpServer()).get(`/api/documents/${doc.id}/extractions`).set(as()).expect(200)).body;
    const skip = await request(app.getHttpServer()).post(`/api/documents/extractions/${ex.id}/review`).set(as()).send({ decision: 'CONFIRM', fields: {} }).expect(400);
    expect(skip.body.message).toMatch(/reference_number/);

    const ok = await request(app.getHttpServer())
      .post(`/api/documents/extractions/${ex.id}/review`)
      .set(as())
      .send({ decision: 'CONFIRM', fields: { reference_number: ['AWD/MH-WRD/2026/0029'], village: ['Borgaon (Meghe)'] } })
      .expect(201);
    expect(ok.body).toMatchObject({ status: 'CONFIRMED', corrections: 1 });
    expect(ok.body.confirmed).toEqual({ survey_numbers: ['441/3'], village: ['Borgaon (Meghe)'], reference_number: ['AWD/MH-WRD/2026/0029'] });

    const audit = await prisma.auditEvent.findFirstOrThrow({ where: { action: 'DOCUMENT_FIELDS_CONFIRMED', entityId: doc.id } });
    expect(audit.newState).toMatchObject({ correctedFields: ['village'] });
    await request(app.getHttpServer()).post(`/api/documents/extractions/${ex.id}/review`).set(as()).send({ decision: 'REJECT', note: 'second review attempt' }).expect(400);
  });

  it('proxies legal questions', async () => {
    const res = await request(app.getHttpServer()).post('/api/legal/ask').set(as()).send({ question: 'What is the solatium?' }).expect(201);
    expect(res.body.citation).toContain('s.30');
    await request(app.getHttpServer()).post('/api/legal/ask').set(as()).send({ question: 'hi' }).expect(400);
  });
});
