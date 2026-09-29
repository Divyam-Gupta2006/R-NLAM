/** Write the OpenAPI document to ../docs/openapi.json (used to type the frontend client). */
import { writeFileSync } from 'fs';
import { join } from 'path';
import { buildOpenApi, createApp } from '../src/main';

async function main() {
  process.env.OUTBOX_DISPATCHER = 'off';
  const app = await createApp();
  await app.init();
  const doc = buildOpenApi(app);
  const out = join(__dirname, '..', '..', 'docs', 'openapi.json');
  writeFileSync(out, JSON.stringify(doc, null, 2) + '\n');
  console.log(`OpenAPI: ${Object.keys(doc.paths).length} paths, ${Object.keys(doc.components?.schemas ?? {}).length} schemas → ${out}`);
  await app.close();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
