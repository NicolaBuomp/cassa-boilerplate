import type { NextConfig } from 'next';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Monorepo: traccia le dipendenze hoistate alla root, così il deploy dal
  // sottopacchetto include i file necessari.
  outputFileTracingRoot: join(currentDir, '../..'),
};

export default nextConfig;
