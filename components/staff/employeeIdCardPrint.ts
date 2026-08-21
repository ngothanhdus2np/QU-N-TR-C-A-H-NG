import { BrandProfile, Employee } from '../../types';

interface BuildEmployeeIdCardHtmlArgs {
  employee: Employee;
  brandProfile?: BrandProfile;
}

export const buildEmployeeIdCardHtml = ({
  employee,
  brandProfile,
}: BuildEmployeeIdCardHtmlArgs): string => {
  const storeName = brandProfile?.name || 'CỬA HÀNG';
  const code = employee.employeeCode || employee.id.slice(0, 8).toUpperCase();
  const photoBlock = employee.photoUrl
    ? `<img src="${employee.photoUrl}" alt="${employee.name}" class="photo" />`
    : `<div class="photo photo-fallback">${employee.name.charAt(0).toUpperCase()}</div>`;
  const logoBlock = brandProfile?.logo
    ? `<img src="${brandProfile.logo}" alt="${storeName}" class="logo" />`
    : '';

  return `
      <html>
        <head>
          <title>In Thẻ Nhân Viên - ${employee.name}</title>
          <style>
            @page { size: 56mm 88mm; margin: 0; }
            body { margin: 0; padding: 0; background: white; }
            .card {
              width: 56mm;
              height: 88mm;
              box-sizing: border-box;
              font-family: 'Segoe UI', Arial, sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              overflow: hidden;
              position: relative;
              border: 1px solid #e5e7eb;
            }
            .header {
              width: 100%;
              padding: 4mm 3mm 2mm;
              text-align: center;
              box-sizing: border-box;
            }
            .logo { max-height: 8mm; max-width: 32mm; object-fit: contain; margin-bottom: 1mm; }
            .store-name { font-size: 11px; font-weight: 900; color: #4f46e5; letter-spacing: 0.5px; margin: 0; }
            .photo {
              width: 30mm;
              height: 30mm;
              border-radius: 50%;
              object-fit: cover;
              border: 1mm solid #818cf8;
              box-sizing: border-box;
            }
            .photo-fallback {
              display: flex;
              align-items: center;
              justify-content: center;
              background: #eef2ff;
              color: #4f46e5;
              font-size: 28px;
              font-weight: 900;
            }
            .accent-line { width: 100%; height: 2mm; background: #818cf8; }
            .banner {
              width: 100%;
              flex: 1;
              background: #4f46e5;
              color: white;
              box-sizing: border-box;
              padding: 4mm 4mm 3mm;
              display: flex;
              flex-direction: column;
              justify-content: flex-end;
              text-align: center;
            }
            .position { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.9; margin: 0 0 1mm; }
            .name { font-size: 16px; font-weight: 900; margin: 0 0 2mm; text-transform: uppercase; }
            .code { font-size: 10px; font-weight: 700; background: white; color: #4f46e5; border-radius: 2mm; padding: 0.5mm 2mm; display: inline-block; margin-bottom: 2mm; }
            .footer-line { font-size: 8px; margin: 0.5mm 0; opacity: 0.95; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header">
              ${logoBlock}
              <p class="store-name">${storeName}</p>
            </div>
            <div style="flex: 1; display: flex; align-items: center;">
              ${photoBlock}
            </div>
            <div class="accent-line"></div>
            <div class="banner">
              <p class="position">${employee.position || 'Nhân viên'}</p>
              <p class="name">${employee.name}</p>
              <p class="code">${code}</p>
              <p class="footer-line">${storeName}</p>
              ${brandProfile?.phone ? `<p class="footer-line">${brandProfile.phone}</p>` : ''}
            </div>
          </div>
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>`;
};
