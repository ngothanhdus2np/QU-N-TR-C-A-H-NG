import React from 'react';

const VatPdfPreview = React.memo(function VatPdfPreview({ vatPreviewUrl }: { vatPreviewUrl: string | null }) {
  const pdfPreviewSrc = vatPreviewUrl ? `${vatPreviewUrl}#toolbar=1&navpanes=0&scrollbar=1` : '';

  return (
    <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-3 py-2">
        <span className="text-2xs font-normal uppercase tracking-wide text-slate-500">PDF hóa đơn gốc</span>
        {vatPreviewUrl && (
          <a
            href={vatPreviewUrl}
            target="_blank"
            rel="noreferrer"
            className="text-2xs font-normal uppercase tracking-wide text-indigo-600 hover:text-indigo-700"
          >
            Mở tab mới
          </a>
        )}
      </div>
      {vatPreviewUrl ? (
        <object
          aria-label="Nội dung hóa đơn VAT"
          data={pdfPreviewSrc}
          type="application/pdf"
          className="h-full min-h-[72vh] w-full bg-white"
        >
          <div className="flex h-full min-h-[72vh] flex-col items-center justify-center gap-3 bg-white px-6 text-center text-xs font-normal text-slate-500">
            <span>Trình duyệt không hiển thị được PDF trong popup.</span>
            <a
              href={vatPreviewUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-normal uppercase tracking-wide text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50"
            >
              Mở tab mới
            </a>
          </div>
        </object>
      ) : (
        <div className="flex h-full min-h-[72vh] items-center justify-center text-xs font-normal text-slate-400">
          Chưa có file PDF để hiển thị.
        </div>
      )}
    </div>
  );
});

export default VatPdfPreview;
