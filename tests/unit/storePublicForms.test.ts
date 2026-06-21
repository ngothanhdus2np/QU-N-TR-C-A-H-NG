import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const route = readFileSync(resolve(process.cwd(), 'routes/store.ts'), 'utf8');
const migration = readFileSync(resolve(process.cwd(), 'supabase_migrations/015_store_public_forms.sql'), 'utf8');

describe('Store public form APIs', () => {
  it('validates and normalizes contact data before a server-side insert', () => {
    expect(route).toContain("router.post('/api/store/contacts', contactLimiter");
    expect(route).toContain('const phone = normalizePhone(String(rawPhone ?? \'\'));');
    expect(route).toContain(".from('store_contacts').insert");
    expect(route).toContain("status: 'new'");
    expect(route).toContain('return res.status(201).json({ ok: true });');
  });

  it('uses an email-conflict upsert for newsletter subscriptions', () => {
    expect(route).toContain("router.post('/api/store/newsletter', newsletterLimiter");
    expect(route).toContain(".from('newsletter_subscribers').upsert");
    expect(route).toContain("{ onConflict: 'email' }");
    expect(route).toContain("source: 'website'");
    expect(route).toContain("status: 'active'");
  });

  it('keeps public form tables closed to direct browser writes via RLS', () => {
    expect(migration).toContain('ALTER TABLE store_contacts ENABLE ROW LEVEL SECURITY;');
    expect(migration).toContain('ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;');
    expect(migration).not.toMatch(/CREATE POLICY[\s\S]*(anon|authenticated)/i);
  });
});
