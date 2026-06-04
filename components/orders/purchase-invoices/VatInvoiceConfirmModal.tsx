import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { VatDocumentItem } from '../../../types';
import type {
  VatDocumentForm,
  VatInvoiceOcrResult,
  VatInvoiceMappingLineForm,
  PurchaseInvoicesProps,
  SupplierProductGroupOption,
} from './types';
import { formatVatMoneyInput, getSupplierInvoiceDefaults } from './utils';
import VatPdfPreview from './VatPdfPreview';

const VAT_FORM_KEYS = [
  'supplierId',
  'issuerName',
  'issuerTaxCode',
  'issuerPhone',
  'issuerAddress',
  'invoiceNo',
  'invoiceDate',
  'totalBeforeTax',
  'vatAmount',
  'totalAmount',
] as const;

type VatInvoiceConfirmModalProps = {
  initialForm: VatDocumentForm;
  suppliers: PurchaseInvoicesProps['suppliers'];
  supplierProductGroupsBySupplierId: Map<string, SupplierProductGroupOption[]>;
  vatDocumentItems: VatDocumentItem[];
  vatPreviewUrl: string | null;
  vatOcrLoading: boolean;
  vatOcrResult: VatInvoiceOcrResult | null;
  savingVatDocument: boolean;
  isPendingUpload: boolean;
  onClose: () => void;
  onConfirm: (form: VatDocumentForm, mappingLines: VatInvoiceMappingLineForm[]) => void;
};

const VatInvoiceConfirmModal = React.memo(function VatInvoiceConfirmModal({
  initialForm,
  suppliers,
  supplierProductGroupsBySupplierId,
  vatDocumentItems,
  vatPreviewUrl,
  vatOcrLoading,
  vatOcrResult,
  savingVatDocument,
  isPendingUpload,
  onClose,
  onConfirm,
}: VatInvoiceConfirmModalProps) {
  const selectedInitialSupplier = useMemo(
    () => suppliers.find(supplier => supplier.id === initialForm.supplierId),
    [initialForm.supplierId, suppliers]
  );
  const initialSupplierQuery = selectedInitialSupplier?.name || initialForm.issuerName || '';
  const [form, setForm] = useState(initialForm);
  const [supplierQuery, setSupplierQuery] = useState(initialSupplierQuery);
  const [supplierSearchFocused, setSupplierSearchFocused] = useState(false);
  const [activePanel, setActivePanel] = useState<'info' | 'mapping'>('info');
  const [mappingFormLines, setMappingFormLines] = useState<VatInvoiceMappingLineForm[]>([]);
  const userEditedRef = useRef(false);
  const supplierEditedRef = useRef(false);
  const previousInitialRef = useRef(initialForm);

  useEffect(() => {
    const previousInitial = previousInitialRef.current;
    setForm(current => {
      if (!userEditedRef.current) return initialForm;
      const next = { ...current };
      VAT_FORM_KEYS.forEach(key => {
        if (!String(current[key] || '').trim() || current[key] === previousInitial[key]) {
          next[key] = initialForm[key];
        }
      });
      return next;
    });
    setSupplierQuery(current => {
      if (!supplierEditedRef.current || !current.trim()) return initialSupplierQuery;
      return current;
    });
    previousInitialRef.current = initialForm;
  }, [initialForm, initialSupplierQuery]);

  const supplierSearchResults = useMemo(() => {
    const query = supplierQuery.trim().toLowerCase();
    return suppliers
      .filter(supplier => {
        if (!query) return true;
        return [supplier.name, supplier.code, supplier.phone, supplier.companyName, supplier.taxCode]
          .filter(Boolean)
          .some(value => String(value).toLowerCase().includes(query));
      })
      .slice(0, 8);
  }, [suppliers, supplierQuery]);

  const supplierProductGroups = useMemo(() => {
    if (!form.supplierId) return [];
    return supplierProductGroupsBySupplierId.get(form.supplierId) || [];
  }, [form.supplierId, supplierProductGroupsBySupplierId]);

  const supplierProductGroupNameSet = useMemo(
    () => new Set(supplierProductGroups.map(group => group.name)),
    [supplierProductGroups]
  );

  const updateField = useCallback((key: keyof VatDocumentForm, value: string) => {
    userEditedRef.current = true;
    setForm(prev => ({ ...prev, [key]: value }));
  }, []);

  const updateMoneyField = useCallback((key: keyof VatDocumentForm, value: string) => {
    userEditedRef.current = true;
    setForm(prev => ({ ...prev, [key]: formatVatMoneyInput(value) }));
  }, []);

  const updateSupplierQuery = useCallback((value: string) => {
    userEditedRef.current = true;
    supplierEditedRef.current = true;
    setSupplierQuery(value);
    setForm(prev => ({ ...prev, supplierId: '' }));
  }, []);

  const selectSupplier = useCallback((supplier: PurchaseInvoicesProps['suppliers'][number]) => {
    userEditedRef.current = true;
    supplierEditedRef.current = true;
    const defaults = getSupplierInvoiceDefaults(supplier);
    setForm(prev => ({
      ...prev,
      supplierId: supplier.id,
      issuerName: defaults.issuerName || prev.issuerName,
      issuerTaxCode: defaults.issuerTaxCode || prev.issuerTaxCode,
      issuerPhone: defaults.issuerPhone || prev.issuerPhone,
      issuerAddress: defaults.issuerAddress || prev.issuerAddress,
    }));
    setSupplierQuery(supplier.name);
    setSupplierSearchFocused(false);
  }, []);

  const initialMappingLines = useMemo<VatInvoiceMappingLineForm[]>(() => {
    if (vatDocumentItems.length > 0) {
      return vatDocumentItems.map(item => ({
        id: item.id,
        name: item.descriptionOnInvoice,
        quantity: item.quantity ? String(item.quantity) : '',
        amount: formatVatMoneyInput(item.totalAmount || item.amountBeforeTax),
        vatGroupId: item.confirmedVatGroupId || item.suggestedVatGroupId || '',
        productGroupName: '',
      }));
    }
    return (vatOcrResult?.items || []).map((item, index) => ({
      id: `ocr-${index}`,
      name: item.name,
      quantity: item.quantity ? String(item.quantity) : '',
      amount: formatVatMoneyInput(item.totalAmount || item.amountBeforeTax),
      vatGroupId: '',
      productGroupName: '',
    }));
  }, [vatDocumentItems, vatOcrResult?.items]);

  useEffect(() => {
    setMappingFormLines(initialMappingLines);
  }, [initialMappingLines]);

  useEffect(() => {
    if (!form.supplierId) return;
    setMappingFormLines(prev =>
      prev.map(line => (
        line.productGroupName && !supplierProductGroupNameSet.has(line.productGroupName)
          ? { ...line, vatGroupId: '', productGroupName: '' }
          : line
      ))
    );
  }, [form.supplierId, supplierProductGroupNameSet]);

  const mappedLineCount = mappingFormLines.filter(line => line.productGroupName).length;

  const addMappingLine = useCallback(() => {
    setMappingFormLines(prev => [
      ...prev,
      {
        id: `manual-${globalThis.crypto?.randomUUID?.() || Date.now()}`,
        name: '',
        quantity: '',
        amount: '',
        vatGroupId: '',
        productGroupName: '',
      },
    ]);
  }, []);

  const updateMappingLine = useCallback((id: string, key: keyof VatInvoiceMappingLineForm, value: string) => {
    setMappingFormLines(prev =>
      prev.map(line => (
        line.id === id
          ? { ...line, [key]: key === 'amount' ? formatVatMoneyInput(value) : value }
          : line
      ))
    );
  }, []);

  const removeMappingLine = useCallback((id: string) => {
    setMappingFormLines(prev => prev.filter(line => line.id !== id));
  }, []);

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-black/50 p-4 pt-20">
      <div className={`flex max-h-[85vh] w-full flex-col overflow-hidden rounded-lg bg-white shadow-2xl transition-[max-width] duration-200 ${
        activePanel === 'mapping' ? 'max-w-[96vw]' : 'max-w-4xl'
      }`}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-sm font-normal uppercase tracking-wide text-slate-800">Xác nhận hóa đơn VAT</p>
            <p className="mt-0.5 text-xs font-normal text-slate-400">
              Bắt buộc chọn nhà cung cấp có sẵn trước khi lưu thông tin xuất hóa đơn.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-2xs font-normal uppercase tracking-wide text-slate-500 hover:bg-slate-50"
          >
            Đóng
          </button>
        </div>

        <div className={`grid min-h-0 flex-1 grid-cols-1 divide-y divide-slate-100 overflow-hidden lg:divide-x lg:divide-y-0 ${
          activePanel === 'mapping'
            ? 'lg:grid-cols-[minmax(420px,0.85fr)_minmax(760px,1.15fr)]'
            : 'lg:grid-cols-[minmax(0,0.8fr)_minmax(460px,1fr)]'
        }`}>
          <div className="flex min-h-0 flex-col space-y-3 p-4">
            <div>
              <p className="text-xs font-normal uppercase tracking-wide text-slate-700">Nội dung hóa đơn</p>
              <p className="mt-1 text-xs font-normal text-slate-400">
                Xem trực tiếp PDF gốc để đối chiếu với thông tin xác nhận bên phải.
              </p>
            </div>
            <VatPdfPreview vatPreviewUrl={vatPreviewUrl} />
          </div>

          <div className="min-h-0 space-y-4 overflow-y-auto p-4">
            <div>
              <p className="text-xs font-normal uppercase tracking-wide text-slate-700">Người dùng xác nhận</p>
              <p className="mt-1 text-xs font-normal text-slate-400">
                {vatOcrLoading
                  ? 'AI đang đọc PDF để tự điền. Bạn vẫn có thể xem hóa đơn bên trái.'
                  : 'Thông tin này sẽ lưu vào hóa đơn VAT và tab Thông tin xuất hóa đơn của nhà cung cấp.'}
              </p>
            </div>
            {vatOcrResult && (
              <div className="rounded-xl border border-green-100 bg-green-50 px-3 py-2 text-xs font-normal text-green-700">
                AI đã tự điền thông tin đọc được từ PDF. Vui lòng đối chiếu với hóa đơn bên trái trước khi xác nhận.
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-100 bg-slate-50 p-1">
              {[
                ['info', 'Thông tin'],
                ['mapping', 'Mapping dòng hàng'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActivePanel(key as 'info' | 'mapping')}
                  className={`rounded-lg px-3 py-2 text-xs font-normal transition-colors ${
                    activePanel === key
                      ? 'bg-white text-indigo-700 shadow-sm'
                      : 'text-slate-500 hover:bg-white/70 hover:text-slate-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {activePanel === 'info' ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-100 bg-white p-3">
                  <p className="mb-3 text-2xs font-normal uppercase tracking-wide text-slate-500">Nhà cung cấp</p>
                  <div className="relative">
                    <input
                      value={supplierQuery}
                      onChange={event => updateSupplierQuery(event.target.value)}
                      onFocus={() => setSupplierSearchFocused(true)}
                      onBlur={() => window.setTimeout(() => setSupplierSearchFocused(false), 120)}
                      placeholder="Gõ tên, mã, SĐT, MST để tìm NCC..."
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-normal text-slate-700 outline-none focus:border-indigo-400 focus:bg-white"
                    />
                    {supplierSearchFocused && (
                      <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
                        {supplierSearchResults.length === 0 ? (
                          <div className="px-3 py-3 text-xs font-normal text-slate-400">Không tìm thấy nhà cung cấp có sẵn.</div>
                        ) : (
                          supplierSearchResults.map(supplier => (
                            <button
                              key={supplier.id}
                              type="button"
                              onMouseDown={event => event.preventDefault()}
                              onClick={() => selectSupplier(supplier)}
                              className="block w-full px-3 py-2 text-left hover:bg-indigo-50"
                            >
                              <span className="block text-xs font-normal text-slate-800">{supplier.name}</span>
                              <span className="mt-0.5 block text-2xs font-normal text-slate-400">
                                {[supplier.code, supplier.phone, supplier.taxCode].filter(Boolean).join(' · ') || 'Không có mã/SĐT/MST'}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                  {!form.supplierId && <p className="mt-2 text-2xs font-normal text-red-500">Bắt buộc chọn nhà cung cấp có sẵn.</p>}
                </div>

                <div className="rounded-xl border border-slate-100 bg-white p-3">
                  <p className="mb-3 text-2xs font-normal uppercase tracking-wide text-slate-500">Thông tin đơn vị xuất hóa đơn</p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {[
                      ['issuerName', 'Tên đơn vị xuất hóa đơn'],
                      ['issuerTaxCode', 'Mã số thuế'],
                      ['issuerPhone', 'Số điện thoại đơn vị'],
                    ].map(([key, label]) => (
                      <label key={key} className={key === 'issuerName' ? 'sm:col-span-2' : ''}>
                        <span className="mb-1 block text-2xs font-normal uppercase tracking-wide text-slate-500">{label}</span>
                        <input
                          value={String(form[key as keyof VatDocumentForm] || '')}
                          onChange={event => updateField(key as keyof VatDocumentForm, event.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-normal text-slate-700 outline-none focus:border-indigo-400 focus:bg-white"
                        />
                      </label>
                    ))}
                    <label className="sm:col-span-2">
                      <span className="mb-1 block text-2xs font-normal uppercase tracking-wide text-slate-500">Địa chỉ xuất hóa đơn</span>
                      <input
                        value={form.issuerAddress}
                        onChange={event => updateField('issuerAddress', event.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-normal text-slate-700 outline-none focus:border-indigo-400 focus:bg-white"
                      />
                    </label>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-100 bg-white p-3">
                  <p className="mb-3 text-2xs font-normal uppercase tracking-wide text-slate-500">Thông tin hóa đơn</p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label>
                      <span className="mb-1 block text-2xs font-normal uppercase tracking-wide text-slate-500">Số hóa đơn</span>
                      <input
                        value={form.invoiceNo}
                        onChange={event => updateField('invoiceNo', event.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-normal text-slate-700 outline-none focus:border-indigo-400 focus:bg-white"
                      />
                    </label>
                    <label>
                      <span className="mb-1 block text-2xs font-normal uppercase tracking-wide text-slate-500">Ngày xuất hóa đơn</span>
                      <input
                        type="date"
                        value={form.invoiceDate}
                        onChange={event => updateField('invoiceDate', event.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-normal text-slate-700 outline-none focus:border-indigo-400 focus:bg-white"
                      />
                    </label>
                    {[
                      ['totalBeforeTax', 'Tiền trước VAT'],
                      ['vatAmount', 'Tiền VAT'],
                      ['totalAmount', 'Tổng tiền'],
                    ].map(([key, label]) => (
                      <label key={key}>
                        <span className="mb-1 block text-2xs font-normal uppercase tracking-wide text-slate-500">{label}</span>
                        <input
                          inputMode="numeric"
                          value={String(form[key as keyof VatDocumentForm] || '')}
                          onChange={event => updateMoneyField(key as keyof VatDocumentForm, event.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-normal text-slate-700 outline-none focus:border-indigo-400 focus:bg-white"
                        />
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-xl border border-slate-100 bg-white p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-normal uppercase tracking-wide text-slate-700">Mapping dòng hàng</p>
                      <p className="mt-1 text-xs font-normal text-slate-400">
                        App tự liệt kê nếu OCR đọc được. Nếu thiếu dòng, thêm thủ công rồi chọn nhóm hàng bên cạnh.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-2xs font-normal uppercase tracking-wide text-slate-600">
                        {mappedLineCount}/{mappingFormLines.length} dòng
                      </span>
                      <button
                        type="button"
                        onClick={addMappingLine}
                        className="rounded-lg bg-indigo-50 px-3 py-1.5 text-2xs font-normal uppercase tracking-wide text-indigo-700 hover:bg-indigo-100"
                      >
                        Thêm dòng
                      </button>
                    </div>
                  </div>
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-100 bg-white">
                  {mappingFormLines.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 px-4 py-10 text-center text-xs font-normal text-slate-400">
                      <span>Chưa có dòng hàng hóa từ PDF để mapping.</span>
                      <button
                        type="button"
                        onClick={addMappingLine}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-2xs font-normal uppercase tracking-wide text-slate-600 hover:bg-slate-50"
                      >
                        Thêm dòng thủ công
                      </button>
                    </div>
                  ) : (
                    <div>
                      <table className="w-full">
                        <thead className="sticky top-0 z-10 border-b border-slate-100 bg-slate-50">
                          <tr>
                            {['Dòng hóa đơn', 'Số tiền', 'Nhóm hàng', ''].map(header => (
                              <th
                                key={header}
                                className="px-3 py-2 text-left text-2xs font-normal uppercase tracking-wide text-slate-400"
                              >
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {mappingFormLines.map(line => (
                            <tr key={line.id}>
                              <td className="min-w-[210px] px-3 py-2">
                                <input
                                  value={line.name}
                                  onChange={event => updateMappingLine(line.id, 'name', event.target.value)}
                                  placeholder="Tên dòng hàng trên hóa đơn..."
                                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-normal text-slate-700 outline-none focus:border-indigo-400 focus:bg-white"
                                />
                                <input
                                  value={line.quantity}
                                  onChange={event => updateMappingLine(line.id, 'quantity', event.target.value)}
                                  placeholder="Số lượng"
                                  inputMode="decimal"
                                  className="mt-1 w-24 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-2xs font-normal text-slate-600 outline-none focus:border-indigo-400"
                                />
                              </td>
                              <td className="min-w-[130px] px-3 py-2">
                                <input
                                  value={line.amount}
                                  onChange={event => updateMappingLine(line.id, 'amount', event.target.value)}
                                  placeholder="0"
                                  inputMode="numeric"
                                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-normal text-slate-700 outline-none focus:border-indigo-400 focus:bg-white"
                                />
                              </td>
                              <td className="min-w-[180px] px-3 py-2">
                                <select
                                  value={line.productGroupName}
                                  onChange={event => {
                                    const selected = supplierProductGroups.find(group => group.name === event.target.value);
                                    setMappingFormLines(prev =>
                                      prev.map(row => (
                                        row.id === line.id
                                          ? {
                                              ...row,
                                              productGroupName: selected?.name || '',
                                              vatGroupId: selected?.vatGroupId || '',
                                            }
                                          : row
                                      ))
                                    );
                                  }}
                                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-normal text-slate-700 outline-none focus:border-indigo-400 focus:bg-white"
                                >
                                  <option value="">
                                    {!form.supplierId
                                      ? 'Chọn NCC trước'
                                      : supplierProductGroups.length === 0
                                        ? 'NCC chưa có nhóm hàng'
                                        : 'Chọn nhóm hàng'}
                                  </option>
                                  {supplierProductGroups.map(group => (
                                    <option key={group.name} value={group.name}>
                                      {group.name}
                                    </option>
                                  ))}
                                </select>
                                {form.supplierId && supplierProductGroups.length === 0 && (
                                  <p className="mt-1 text-2xs font-normal text-amber-600">
                                    Chưa tìm thấy nhóm hàng từ phiếu nhập của NCC này.
                                  </p>
                                )}
                                <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-2xs font-normal uppercase tracking-wide ${
                                  line.productGroupName ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                                }`}>
                                  {line.productGroupName ? 'Đã mapping' : 'Cần mapping'}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-right">
                                <button
                                  type="button"
                                  onClick={() => removeMappingLine(line.id)}
                                  className="rounded-lg px-2 py-1 text-2xs font-normal uppercase tracking-wide text-red-500 hover:bg-red-50"
                                >
                                  Xóa
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <button
            onClick={() => onConfirm(form, mappingFormLines)}
            disabled={savingVatDocument || isPendingUpload}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-2xs font-normal uppercase tracking-wide text-white shadow-md shadow-indigo-100 disabled:opacity-60"
          >
            {savingVatDocument ? 'Đang lưu...' : isPendingUpload ? 'Đang upload...' : 'Xác nhận'}
          </button>
        </div>
      </div>
    </div>
  );
});

export default VatInvoiceConfirmModal;
