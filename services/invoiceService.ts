import { supabase } from './supabase';
import { generateId } from '../src/lib';

export type InvoiceStatus = 'full' | 'partial' | 'memo_only' | 'none';

export async function uploadPurchaseInvoice(
  transactionId: string,
  file: File,
  uploadedBy?: string
): Promise<void> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'pdf';
  const storagePath = `${transactionId}/${generateId()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('purchase-invoices')
    .upload(storagePath, file, { upsert: false });

  if (uploadError) throw uploadError;

  const { error: dbError } = await supabase.from('invoice_attachments').insert({
    id: generateId(),
    purchase_record_id: transactionId,
    file_name: file.name,
    file_url: storagePath,
    file_type: ext,
    uploaded_by: uploadedBy,
    uploaded_at: new Date().toISOString(),
  });

  if (dbError) throw dbError;
}
