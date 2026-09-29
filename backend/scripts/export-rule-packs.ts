/** Write the shipped rule packs to ai-service/app/data/rule_packs.json for the legal Q&A index. */
import { writeFileSync } from 'fs';
import { join } from 'path';
import { SHIPPED_PACKS } from '../src/rules/rule-packs.data';

const out = join(__dirname, '..', '..', 'ai-service', 'app', 'data', 'rule_packs.json');
writeFileSync(out, JSON.stringify(SHIPPED_PACKS, null, 2) + '\n');
console.log(`${SHIPPED_PACKS.length} packs → ${out}`);
