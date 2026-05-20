import { supabaseAdmin as supabase } from './supabase';

// Các bảng cần theo dõi thay đổi tài chính / nhân sự
const AUDITED_KEYS = new Set([
  'payroll', 'revenue', 'expenses', 'employees', 'advances', 'shortages',
]);

export const isAudited = (key: string): boolean => AUDITED_KEYS.has(key);

export const auditService = {
  /**
   * Ghi log một thay đổi dữ liệu. Fire-and-forget — không block luồng chính.
   * @param tableName  tên key trong TABLE_MAP (vd: 'payroll', 'revenue')
   * @param recordId   ID của bản ghi (null cho clear_table)
   * @param action     'upsert' | 'delete' | 'clear_table'
   * @param newValue   dữ liệu mới sau thay đổi (undefined cho delete/clear)
   */
  log(tableName: string, recordId: string | null, action: string, newValue?: any): void {
    void supabase
      .from('audit_trail')
      .insert({
        table_name: tableName,
        record_id: recordId,
        action,
        new_value: newValue !== undefined ? newValue : null,
        changed_at: new Date().toISOString(),
      })
      .then(({ error }: { error: any }) => {
        if (error) console.error('[Audit] Lỗi ghi audit trail:', error.message);
      });
  },
};
