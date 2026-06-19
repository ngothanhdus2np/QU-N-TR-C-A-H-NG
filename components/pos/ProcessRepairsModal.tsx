import React, { useMemo, useState } from 'react';
import { Calendar, Inbox, X } from 'lucide-react';

type RepairStatus = 'processing' | 'completed' | 'cancelled';

interface RepairTicket {
  id: string;
  code: string;
  createdAt: string;
  customerName?: string;
  customerPhone?: string;
  deviceName?: string;
  returnDate?: string;
  status: RepairStatus;
}

const STATUS_CONFIG: Record<RepairStatus, { label: string; className: string }> = {
  processing: { label: 'Đang xử lý', className: 'bg-amber-50 text-amber-700' },
  completed: { label: 'Hoàn thành', className: 'bg-emerald-50 text-emerald-700' },
  cancelled: { label: 'Đã hủy', className: 'bg-slate-100 text-slate-500' },
};

interface ProcessRepairsModalProps {
  tickets?: RepairTicket[];
  onClose: () => void;
}

export default function ProcessRepairsModal({ tickets = [], onClose }: ProcessRepairsModalProps) {
  const [searchCode, setSearchCode] = useState('');
  const [searchCustomer, setSearchCustomer] = useState('');
  const [searchSerial, setSearchSerial] = useState('');
  const [searchDevice, setSearchDevice] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const filtered = useMemo(() => {
    return tickets
      .filter(t => {
        if (searchCode && !t.code.toLowerCase().includes(searchCode.toLowerCase())) return false;
        if (
          searchCustomer &&
          !(t.customerName || '').toLowerCase().includes(searchCustomer.toLowerCase()) &&
          !(t.customerPhone || '').includes(searchCustomer)
        )
          return false;
        if (
          searchDevice &&
          !(t.deviceName || '').toLowerCase().includes(searchDevice.toLowerCase())
        )
          return false;
        if (dateFrom && t.createdAt.slice(0, 10) < dateFrom) return false;
        if (dateTo && t.createdAt.slice(0, 10) > dateTo) return false;
        return true;
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [tickets, searchCode, searchCustomer, searchDevice, dateFrom, dateTo]);

  return (
    <div className="fixed inset-0 bg-black/40 z-modal flex items-center justify-center p-6">
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col overflow-hidden"
        style={{ maxHeight: '82vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <h2 className="text-base font-semibold text-slate-800">Xử lý yêu cầu sửa chữa</h2>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 min-h-0">
          {/* Sidebar */}
          <div className="w-64 shrink-0 border-r border-slate-100 overflow-y-auto bg-white p-4 space-y-5">
            {/* Tìm kiếm */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                Tìm kiếm
              </p>
              <div className="space-y-3">
                <SearchInput
                  placeholder="Theo mã yêu cầu"
                  value={searchCode}
                  onChange={setSearchCode}
                />
                <SearchInput
                  placeholder="Theo mã, tên, SĐT KH"
                  value={searchCustomer}
                  onChange={setSearchCustomer}
                />
                <SearchInput
                  placeholder="Theo Serial/IMEI/Biển số"
                  value={searchSerial}
                  onChange={setSearchSerial}
                />
                <SearchInput
                  placeholder="Theo tên, mã hàng"
                  value={searchDevice}
                  onChange={setSearchDevice}
                />
              </div>
            </div>

            {/* Thời gian */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                Thời gian
              </p>
              <div className="space-y-3">
                <DateInput value={dateFrom} onChange={setDateFrom} placeholder="Từ ngày" />
                <DateInput value={dateTo} onChange={setDateTo} placeholder="Đến ngày" />
              </div>
            </div>
          </div>

          {/* Main Table */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {/* Table header */}
            <div className="bg-indigo-600 shrink-0">
              <div
                className="grid text-white text-xs font-semibold"
                style={{ gridTemplateColumns: '1.6fr 1.6fr 1.2fr 1.4fr' }}
              >
                <div className="px-4 py-3">Yêu cầu sửa chữa</div>
                <div className="px-4 py-3">Hàng sửa chữa</div>
                <div className="px-4 py-3">Hẹn trả khách</div>
                <div className="px-4 py-3">Trạng thái sửa chữa</div>
              </div>
            </div>

            {/* Table body */}
            <div className="flex-1 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400 py-16">
                  <Inbox className="h-10 w-10 text-slate-300" strokeWidth={1.5} />
                  <p className="text-sm">Không tìm thấy kết quả nào phù hợp</p>
                </div>
              ) : (
                filtered.map((ticket, idx) => {
                  const status = STATUS_CONFIG[ticket.status];
                  const createdDate = new Date(ticket.createdAt).toLocaleDateString('vi-VN', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  });
                  const returnDateDisplay = ticket.returnDate
                    ? new Date(ticket.returnDate + 'T00:00:00').toLocaleDateString('vi-VN', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                      })
                    : '—';
                  return (
                    <div
                      key={ticket.id}
                      className={`grid text-sm border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}
                      style={{ gridTemplateColumns: '1.6fr 1.6fr 1.2fr 1.4fr' }}
                    >
                      <div className="px-4 py-3">
                        <div className="text-indigo-600 text-xs font-semibold">
                          {ticket.code}
                        </div>
                        <div className="text-slate-400 text-xs mt-0.5">{createdDate}</div>
                      </div>
                      <div className="px-4 py-3">
                        <div className="text-slate-700 text-xs truncate">
                          {ticket.deviceName || <span className="text-slate-400 italic">—</span>}
                        </div>
                        {ticket.customerName && (
                          <div className="text-slate-400 text-xs mt-0.5">
                            {ticket.customerName}
                            {ticket.customerPhone ? ` · ${ticket.customerPhone}` : ''}
                          </div>
                        )}
                      </div>
                      <div className="px-4 py-3 text-slate-600 text-xs">{returnDateDisplay}</div>
                      <div className="px-4 py-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${status.className}`}
                        >
                          {status.label}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SearchInput({
  placeholder,
  value,
  onChange,
}: {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      type="text"
      placeholder={placeholder}
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full border-0 border-b border-slate-200 bg-transparent pb-1.5 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 transition-colors"
    />
  );
}

function DateInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const display = value
    ? new Date(value + 'T00:00:00').toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : placeholder;

  return (
    <label className="flex items-center justify-between border-b border-slate-200 pb-1.5 cursor-pointer group">
      <span className={`text-xs ${value ? 'text-slate-700' : 'text-slate-400'}`}>{display}</span>
      <Calendar className="h-3.5 w-3.5 text-slate-400 group-hover:text-indigo-500 transition-colors shrink-0" />
      <input
        type="date"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="absolute opacity-0 w-0 h-0 pointer-events-none"
        tabIndex={-1}
      />
    </label>
  );
}
