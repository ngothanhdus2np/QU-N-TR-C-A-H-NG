-- Migration 009: VAT Coverage ledger for purchase invoices
-- Adds VAT grouping, document warehouse, and allocation ledger without changing
-- existing inventory_transactions / invoice_attachments data.

CREATE TABLE IF NOT EXISTS vat_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  branch_id TEXT NOT NULL DEFAULT 'main',
  tenant_id TEXT NOT NULL DEFAULT 'phuc-sang',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_vat_groups_name_tenant
  ON vat_groups (tenant_id, lower(name));

CREATE TABLE IF NOT EXISTS sku_vat_group_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT NOT NULL,
  product_id TEXT,
  product_name TEXT,
  vat_group_id UUID NOT NULL REFERENCES vat_groups(id),
  confidence_score NUMERIC DEFAULT 1,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'keyword', 'import', 'auto')),
  branch_id TEXT NOT NULL DEFAULT 'main',
  tenant_id TEXT NOT NULL DEFAULT 'phuc-sang',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sku_vat_group_mapping_sku_tenant
  ON sku_vat_group_mapping (tenant_id, lower(sku));
CREATE INDEX IF NOT EXISTS idx_sku_vat_group_mapping_group ON sku_vat_group_mapping (vat_group_id);

CREATE TABLE IF NOT EXISTS supplier_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id TEXT NOT NULL,
  alias_name TEXT NOT NULL,
  tax_code TEXT,
  branch_id TEXT NOT NULL DEFAULT 'main',
  tenant_id TEXT NOT NULL DEFAULT 'phuc-sang',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_supplier_aliases_supplier ON supplier_aliases (supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_aliases_tax_code ON supplier_aliases (tax_code);
CREATE INDEX IF NOT EXISTS idx_supplier_aliases_alias ON supplier_aliases (tenant_id, lower(alias_name));

CREATE TABLE IF NOT EXISTS vat_group_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vat_group_id UUID NOT NULL REFERENCES vat_groups(id),
  keyword TEXT NOT NULL,
  normalized_keyword TEXT NOT NULL,
  branch_id TEXT NOT NULL DEFAULT 'main',
  tenant_id TEXT NOT NULL DEFAULT 'phuc-sang',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_vat_group_keywords_group ON vat_group_keywords (vat_group_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_vat_group_keywords_normalized_tenant
  ON vat_group_keywords (tenant_id, normalized_keyword);

CREATE TABLE IF NOT EXISTS vat_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id TEXT,
  supplier_name_on_invoice TEXT,
  supplier_tax_code TEXT,
  supplier_match_confidence NUMERIC DEFAULT 0,
  supplier_match_status TEXT NOT NULL DEFAULT 'needs_confirmation'
    CHECK (supplier_match_status IN ('matched', 'needs_confirmation', 'unmatched')),
  invoice_no TEXT NOT NULL,
  invoice_date TEXT NOT NULL,
  total_before_tax NUMERIC DEFAULT 0,
  vat_amount NUMERIC DEFAULT 0,
  total_amount NUMERIC DEFAULT 0,
  file_pdf_url TEXT,
  file_xml_url TEXT,
  status TEXT NOT NULL DEFAULT 'unallocated'
    CHECK (status IN ('unallocated', 'partial', 'completed', 'over_allocated', 'void')),
  note TEXT,
  void_reason TEXT,
  voided_at TIMESTAMP WITH TIME ZONE,
  voided_by TEXT,
  branch_id TEXT NOT NULL DEFAULT 'main',
  tenant_id TEXT NOT NULL DEFAULT 'phuc-sang',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_by TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_vat_documents_supplier ON vat_documents (supplier_id);
CREATE INDEX IF NOT EXISTS idx_vat_documents_tax_code ON vat_documents (supplier_tax_code);
CREATE INDEX IF NOT EXISTS idx_vat_documents_invoice_no ON vat_documents (invoice_no);
CREATE INDEX IF NOT EXISTS idx_vat_documents_date ON vat_documents (invoice_date);
CREATE INDEX IF NOT EXISTS idx_vat_documents_status ON vat_documents (status);

CREATE TABLE IF NOT EXISTS vat_document_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vat_document_id UUID NOT NULL REFERENCES vat_documents(id) ON DELETE CASCADE,
  description_on_invoice TEXT NOT NULL,
  suggested_vat_group_id UUID REFERENCES vat_groups(id),
  confirmed_vat_group_id UUID REFERENCES vat_groups(id),
  quantity NUMERIC DEFAULT 0,
  amount_before_tax NUMERIC DEFAULT 0,
  vat_amount NUMERIC DEFAULT 0,
  total_amount NUMERIC DEFAULT 0,
  allocated_quantity NUMERIC DEFAULT 0,
  allocated_amount NUMERIC DEFAULT 0,
  remaining_quantity NUMERIC GENERATED ALWAYS AS (GREATEST(quantity - allocated_quantity, 0)) STORED,
  remaining_amount NUMERIC GENERATED ALWAYS AS (GREATEST(amount_before_tax - allocated_amount, 0)) STORED,
  confidence_score NUMERIC DEFAULT 0,
  mapping_status TEXT NOT NULL DEFAULT 'needs_confirmation'
    CHECK (mapping_status IN ('suggested', 'confirmed', 'needs_confirmation')),
  branch_id TEXT NOT NULL DEFAULT 'main',
  tenant_id TEXT NOT NULL DEFAULT 'phuc-sang',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_vat_document_items_doc ON vat_document_items (vat_document_id);
CREATE INDEX IF NOT EXISTS idx_vat_document_items_confirmed_group ON vat_document_items (confirmed_vat_group_id);
CREATE INDEX IF NOT EXISTS idx_vat_document_items_suggested_group ON vat_document_items (suggested_vat_group_id);

CREATE TABLE IF NOT EXISTS vat_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vat_document_item_id UUID NOT NULL REFERENCES vat_document_items(id),
  purchase_receipt_id TEXT NOT NULL,
  purchase_receipt_item_id TEXT,
  vat_group_id UUID NOT NULL REFERENCES vat_groups(id),
  allocated_quantity NUMERIC DEFAULT 0,
  allocated_amount NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_by TEXT,
  allocation_method TEXT NOT NULL DEFAULT 'manual' CHECK (allocation_method IN ('auto', 'manual')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'void')),
  void_reason TEXT,
  voided_at TIMESTAMP WITH TIME ZONE,
  voided_by TEXT,
  branch_id TEXT NOT NULL DEFAULT 'main',
  tenant_id TEXT NOT NULL DEFAULT 'phuc-sang'
);

CREATE INDEX IF NOT EXISTS idx_vat_allocations_document_item ON vat_allocations (vat_document_item_id);
CREATE INDEX IF NOT EXISTS idx_vat_allocations_receipt ON vat_allocations (purchase_receipt_id);
CREATE INDEX IF NOT EXISTS idx_vat_allocations_group ON vat_allocations (vat_group_id);
CREATE INDEX IF NOT EXISTS idx_vat_allocations_status ON vat_allocations (status);

CREATE TABLE IF NOT EXISTS vat_allocation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  allocation_id UUID REFERENCES vat_allocations(id),
  vat_document_id UUID REFERENCES vat_documents(id),
  action TEXT NOT NULL CHECK (action IN ('created', 'voided', 'confirmed_mapping', 'updated_mapping', 'document_voided')),
  reason TEXT,
  snapshot JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_by TEXT,
  branch_id TEXT NOT NULL DEFAULT 'main',
  tenant_id TEXT NOT NULL DEFAULT 'phuc-sang'
);

CREATE INDEX IF NOT EXISTS idx_vat_allocation_events_allocation ON vat_allocation_events (allocation_id);
CREATE INDEX IF NOT EXISTS idx_vat_allocation_events_document ON vat_allocation_events (vat_document_id);
CREATE INDEX IF NOT EXISTS idx_vat_allocation_events_action ON vat_allocation_events (action);

ALTER TABLE vat_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE sku_vat_group_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE vat_group_keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE vat_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE vat_document_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE vat_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE vat_allocation_events ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON vat_groups TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON sku_vat_group_mapping TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON supplier_aliases TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON vat_group_keywords TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON vat_documents TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON vat_document_items TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON vat_allocations TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON vat_allocation_events TO anon, authenticated;

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'vat_groups',
    'sku_vat_group_mapping',
    'supplier_aliases',
    'vat_group_keywords',
    'vat_documents',
    'vat_document_items',
    'vat_allocations',
    'vat_allocation_events'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%s_anon_all" ON %I', table_name, table_name);
    EXECUTE format('CREATE POLICY "%s_anon_all" ON %I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)', table_name, table_name);
  END LOOP;
END $$;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vat-documents',
  'vat-documents',
  false,
  52428800,
  ARRAY['application/pdf', 'text/xml', 'application/xml']::text[]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "vat-documents read" ON storage.objects;
DROP POLICY IF EXISTS "vat-documents upload" ON storage.objects;
DROP POLICY IF EXISTS "vat-documents update" ON storage.objects;
DROP POLICY IF EXISTS "vat-documents delete" ON storage.objects;

CREATE POLICY "vat-documents read"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'vat-documents');

CREATE POLICY "vat-documents upload"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'vat-documents');

CREATE POLICY "vat-documents update"
  ON storage.objects FOR UPDATE
  TO anon, authenticated
  USING (bucket_id = 'vat-documents')
  WITH CHECK (bucket_id = 'vat-documents');

CREATE POLICY "vat-documents delete"
  ON storage.objects FOR DELETE
  TO anon, authenticated
  USING (bucket_id = 'vat-documents');

NOTIFY pgrst, 'reload schema';
