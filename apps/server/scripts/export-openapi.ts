import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { buildOpenApiDocument } from '../src/http/openapi';

const target = path.resolve(__dirname, '..', '..', '..', 'docs', 'openapi.json');
writeFileSync(target, JSON.stringify(buildOpenApiDocument(), null, 2) + '\n');
console.log(`Wrote ${target}`);
