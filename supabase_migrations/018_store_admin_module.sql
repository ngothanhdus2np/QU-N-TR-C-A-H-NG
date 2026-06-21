-- Website admin module: configuration, media storage and server-only writes.

CREATE TABLE IF NOT EXISTS store_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS store_media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  path TEXT NOT NULL UNIQUE,
  public_url TEXT NOT NULL,
  alt_text TEXT NOT NULL DEFAULT '',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO store_settings (key, value) VALUES
  ('website', jsonb_build_object(
    'shipping_policy', jsonb_build_object('threshold', 800000, 'fee_below_threshold', 30000),
    'hotline', '', 'address', '', 'social_links', jsonb_build_object(),
    'bank_accounts', jsonb_build_array(), 'footer', jsonb_build_object()
  ))
ON CONFLICT (key) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'store-media', 'store-media', TRUE, 10485760,
  ARRAY['image/webp', 'image/jpeg', 'image/png', 'image/avif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_preorder_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;

-- Public website reads products only through Store API. Authenticated browser
-- clients must not mutate Website data directly; Admin Store API uses service role.
DROP POLICY IF EXISTS "store_products_authenticated" ON store_products;
DROP POLICY IF EXISTS "store_product_variants_authenticated" ON store_product_variants;

NOTIFY pgrst, 'reload schema';
