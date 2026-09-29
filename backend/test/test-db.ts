/** The e2e suite runs against its own database, `<dev db>_test`, never the dev data. */
export function testDatabaseUrl(): string {
  const base = process.env.DATABASE_URL;
  if (!base) throw new Error('DATABASE_URL is not set (backend/.env)');
  const url = new URL(base);
  const db = url.pathname.replace(/^\//, '');
  url.pathname = `/${db.endsWith('_test') ? db : `${db}_test`}`;
  return url.toString();
}

export function withDatabase(urlString: string, db: string): string {
  const url = new URL(urlString);
  url.pathname = `/${db}`;
  return url.toString();
}
