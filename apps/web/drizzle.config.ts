import type { Config } from 'drizzle-kit'

import env from './src/env'

const testEnv = process.env.NODE_ENV === 'test'
const connectionString = testEnv ? env.TEST_DATABASE_URL : env.DATABASE_URL

export default {
  dialect: 'postgresql',
  schema: './node_modules/@latitude-data/database/src/schema/index.ts',
  out: './drizzle',
  dbCredentials: {
    url: connectionString,
  },
} satisfies Config
