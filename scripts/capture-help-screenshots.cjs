#!/usr/bin/env node
/**
 * Tự động chụp màn hình từng bước cho trang Hướng dẫn sử dụng.
 * Cần cài tạm: npm i -D @playwright/test (đã gỡ khỏi package.json vì không dùng cho E2E)
 * Chạy: node scripts/capture-help-screenshots.cjs [tên-bài]
 * Ảnh lưu tại: public/help/images/{tên-bài}/01-name.jpg
 */

const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const IMAC_HOST = 'mac@192.168.1.3';
const IMAC_ASSETS_DIR = '~/cfobrain-assets/help/images';

const BASE_URL = 'http://localhost:3000';
const OUT_DIR = path.resolve(__dirname, '../public/help/images');
const EMAIL = 'admin';
const PASSWORD = '123456';

// ── Helpers ──────────────────────────────────────────────────────────────────

async function login(page) {
  await page.goto(BASE_URL);
  await page.waitForTimeout(2500);

  const hasLoginForm = await page.locator('input[type="password"]').count() > 0;
  if (hasLoginForm) {
    await page.fill('input[type="text"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    console.log('  ✓ Đã đăng nhập');
    return;
  }

  console.log('  ✓ Sẵn sàng');
}

async function goTo(page, urlPath) {
  await page.goto(`${BASE_URL}/${urlPath}`);
  await page.waitForTimeout(1800);
}

async function highlightEl(page, locator) {
  try {
    await locator.evaluate((el) => {
      el.style.outline = '3px solid #E63329';
      el.style.outlineOffset = '2px';
      el.style.borderRadius = '6px';
      const badge = document.createElement('div');
      badge.textContent = '→';
      badge.style.cssText = `
        position:absolute;z-index:99999;background:#E63329;color:#fff;
        border-radius:4px;padding:1px 6px;font-size:11px;font-weight:700;
        display:flex;align-items:center;justify-content:center;
        top:-18px;left:0;pointer-events:none;white-space:nowrap;
      `;
      el.style.position = 'relative';
      el.appendChild(badge);
      el._helpBadge = badge;
    });
    return true;
  } catch (e) { return false; }
}

async function unhighlightEl(page, locator) {
  try {
    await locator.evaluate((el) => {
      el.style.outline = '';
      el.style.outlineOffset = '';
      if (el._helpBadge) { el._helpBadge.remove(); delete el._helpBadge; }
    });
  } catch (e) {}
}

// articleDir: đường dẫn thư mục của bài (vd: public/help/images/pos-intro/)
async function shot(page, articleDir, filename, { selector, highlight, locatorHighlight, fullPage } = {}) {
  const filepath = path.join(articleDir, filename);
  await page.waitForTimeout(600);

  if (highlight) {
    await page.evaluate((sel) => {
      const els = Array.isArray(sel) ? sel : [sel];
      els.forEach((s, i) => {
        const el = typeof s === 'string' ? document.querySelector(s) : s;
        if (!el) return;
        el.style.outline = '3px solid #E63329';
        el.style.outlineOffset = '2px';
        el.style.borderRadius = '6px';
        const badge = document.createElement('div');
        badge.textContent = i + 1;
        badge.style.cssText = `
          position:absolute;z-index:99999;background:#E63329;color:#fff;
          border-radius:50%;width:22px;height:22px;font-size:12px;font-weight:700;
          display:flex;align-items:center;justify-content:center;
          top:-10px;left:-10px;pointer-events:none;
        `;
        el.style.position = 'relative';
        el.appendChild(badge);
        el._helpBadge = badge;
      });
    }, highlight);
  }

  if (locatorHighlight) {
    await highlightEl(page, locatorHighlight);
  }

  if (selector) {
    const el = await page.locator(selector).first();
    await el.screenshot({ path: filepath });
  } else {
    await page.screenshot({ path: filepath, fullPage: !!fullPage });
  }

  if (highlight) {
    await page.evaluate((sel) => {
      const els = Array.isArray(sel) ? sel : [sel];
      els.forEach((s) => {
        const el = typeof s === 'string' ? document.querySelector(s) : s;
        if (!el) return;
        el.style.outline = '';
        el.style.outlineOffset = '';
        if (el._helpBadge) { el._helpBadge.remove(); delete el._helpBadge; }
      });
    }, highlight);
  }

  if (locatorHighlight) {
    await unhighlightEl(page, locatorHighlight);
  }

  console.log(`  📸 ${filename}`);
}

// ── Kịch bản chụp ────────────────────────────────────────────────────────────

const SCENARIOS = {

  // ── Bán hàng: Giới thiệu màn hình ─────────────────────────────────────────
  'pos-intro': async (page, dir) => {
    await goTo(page, 'pos');
    await page.waitForTimeout(1500);

    await shot(page, dir, '01-overview.jpg');

    const searchSel = 'input[placeholder*="Tìm hàng"], input[placeholder*="hàng hóa"], input[placeholder*="F3"], input[placeholder*="Tìm kiếm"]';
    await shot(page, dir, '02-searchbox.jpg', { highlight: searchSel });

    const searchInput = page.locator(searchSel).first();
    if (await searchInput.count()) {
      await searchInput.fill('d');
      await page.waitForTimeout(600);
      await searchInput.fill('dé');
      await page.waitForTimeout(600);
      await shot(page, dir, '03-results.jpg');
    }

    await page.keyboard.press('Enter');
    await page.waitForTimeout(800);
    if (await searchInput.count()) {
      await searchInput.fill('');
      await page.waitForTimeout(400);
    }
    await shot(page, dir, '04-cart.jpg');

    await shot(page, dir, '05-tabs.jpg');

    const qtySel = 'input[type="number"]';
    const hasQty = await page.locator(qtySel).count() > 0;
    if (hasQty) {
      await shot(page, dir, '06-qty.jpg', { highlight: qtySel });
    } else {
      await shot(page, dir, '06-qty.jpg');
    }

    const menuBtn = page.locator([
      'button[title*="Menu"]',
      'button:has([data-lucide="layout-grid"])',
      'button:has([data-lucide="sliders-horizontal"])',
      'button:has([data-lucide="more-horizontal"])',
    ].join(', ')).first();
    if (await menuBtn.count()) {
      await menuBtn.click();
      await page.waitForTimeout(800);
      await shot(page, dir, '07-menu.jpg');
      await page.keyboard.press('Escape');
    } else {
      await shot(page, dir, '07-menu.jpg');
    }
  },

  // ── Bán hàng: Tạo đơn và thanh toán ──────────────────────────────────────
  'pos-create-order': async (page, dir) => {
    await goTo(page, 'pos');
    await page.waitForTimeout(1500);

    const searchSel = 'input[placeholder*="Tìm hàng"], input[placeholder*="hàng hóa"], input[placeholder*="F3"]';
    const searchInput = page.locator(searchSel).first();

    await shot(page, dir, '01-search-highlight.jpg', { highlight: searchSel });

    if (await searchInput.count()) {
      await searchInput.fill('dé');
      await page.waitForTimeout(600);
      await searchInput.fill('dép');
      await page.waitForTimeout(800);
    }
    await shot(page, dir, '02-results.jpg');

    await page.keyboard.press('Enter');
    await page.waitForTimeout(600);
    if (await searchInput.count()) {
      await searchInput.fill('dép');
      await page.waitForTimeout(600);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(400);
      await searchInput.fill('');
      await page.waitForTimeout(400);
    }
    await shot(page, dir, '03-cart.jpg');

    const qtySel = 'input[type="number"]';
    if (await page.locator(qtySel).count() > 0) {
      await shot(page, dir, '04-qty.jpg', { highlight: qtySel });
    }

    const custSel = 'input[placeholder*="Tìm khách"], input[placeholder*="khách hàng"], input[placeholder*="F4"]';
    if (await page.locator(custSel).count() > 0) {
      await shot(page, dir, '05-customer-highlight.jpg', { highlight: custSel });

      const custInput = page.locator(custSel).first();
      await custInput.fill('Khách');
      await page.waitForTimeout(800);
      await shot(page, dir, '06-customer-results.jpg');
      await page.keyboard.press('Escape');
      await custInput.fill('');
      await page.waitForTimeout(400);
    }

    const discountSel = 'input[placeholder*="giảm"], input[placeholder*="chiết khấu"], [class*="discount"] input';
    if (await page.locator(discountSel).count() > 0) {
      await shot(page, dir, '07-discount.jpg', { highlight: discountSel });
    } else {
      await shot(page, dir, '07-discount.jpg');
    }

    await shot(page, dir, '08-payment.jpg');

    const payBtnLoc = page.locator('button:has-text("Thanh toán")').first();
    if (await payBtnLoc.count() > 0) {
      await shot(page, dir, '09-pay-btn.jpg', { locatorHighlight: payBtnLoc });
    }

    const bankBtn = page.locator([
      'label:has-text("Chuyển khoản")',
      'input[value="Bank"]',
      'input[value="Chuyển khoản"]',
      'button:has-text("Chuyển khoản")',
    ].join(', ')).first();
    if (await bankBtn.count()) {
      await bankBtn.click({ force: true });
      await page.waitForTimeout(1200);
      await shot(page, dir, '10-bank-qr.jpg');
    }
  },

  // ── Hàng hóa: Tra cứu sản phẩm ───────────────────────────────────────────
  'goods-search': async (page, dir) => {
    await goTo(page, 'goods');
    await page.waitForTimeout(2000);

    await shot(page, dir, '01-list.jpg');

    const searchSel = 'input[placeholder*="Tìm"], input[placeholder*="tên"], input[placeholder*="mã hàng"]';
    await shot(page, dir, '02-searchbox.jpg', { highlight: searchSel });

    const searchInput = page.locator(searchSel).first();
    if (await searchInput.count()) {
      await searchInput.fill('dép');
      await page.waitForTimeout(1000);
      await shot(page, dir, '03-filtered.jpg');
      await searchInput.fill('');
      await page.waitForTimeout(600);
    }

    const sidebarSel = 'aside, [class*="filter-sidebar"], [class*="FilterSidebar"]';
    const hasSidebar = await page.locator(sidebarSel).count() > 0;
    if (hasSidebar) {
      await shot(page, dir, '04-sidebar.jpg', { selector: sidebarSel });
    } else {
      await shot(page, dir, '04-sidebar.jpg');
    }

    const firstFilterBtn = page.locator('aside button, aside label, aside [role="checkbox"]').first();
    if (await firstFilterBtn.count()) {
      await firstFilterBtn.click({ force: true });
      await page.waitForTimeout(800);
      await shot(page, dir, '05-filter-active.jpg');
      await firstFilterBtn.click({ force: true });
      await page.waitForTimeout(500);
    }

    const modal = page.locator('.fixed.inset-0, [class*="modal"], [class*="Modal"], [class*="overlay"]').first();
    if (await modal.count()) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(600);
    }

    const gridBtn = page.locator([
      'button:has([data-lucide="layout-grid"])',
      'button:has([class*="LayoutGrid"])',
      'button[title*="lưới"]',
    ].join(', ')).first();
    if (await gridBtn.count()) {
      await gridBtn.click({ force: true });
      await page.waitForTimeout(800);
      await shot(page, dir, '06-grid.jpg');
      const tableBtn = page.locator([
        'button:has([data-lucide="list"])',
        'button:has([class*="List"])',
        'button[title*="bảng"]',
      ].join(', ')).first();
      if (await tableBtn.count()) {
        await tableBtn.click({ force: true });
        await page.waitForTimeout(600);
      }
    }

    const firstItem = page.locator('table tbody tr').first();
    if (await firstItem.count()) {
      await firstItem.click({ force: true });
      await page.waitForTimeout(1200);
      await shot(page, dir, '07-detail.jpg');
    }
  },

  // ── Hàng hóa: Điều chỉnh tồn kho ─────────────────────────────────────────
  'goods-adjust': async (page, dir) => {
    await goTo(page, 'goods');
    await page.waitForTimeout(1500);

    await shot(page, dir, '01-overview.jpg');

    const khoTab = page.locator('button:has-text("Kiểm kho"), button:has-text("kiểm kho")').first();
    if (await khoTab.count()) {
      await shot(page, dir, '02-audit-highlight.jpg', { locatorHighlight: khoTab });
      await khoTab.click({ force: true });
      await page.waitForTimeout(1200);
      await shot(page, dir, '03-audit.jpg');

      const createBtn = page.locator('button:has-text("Tạo"), button:has-text("Kiểm kho mới")').first();
      if (await createBtn.count()) {
        await shot(page, dir, '04-audit-create-btn.jpg', { locatorHighlight: createBtn });
      }
    }

    const purchaseTab = page.locator('button:has-text("Nhập hàng")').first();
    if (await purchaseTab.count()) {
      await shot(page, dir, '05-purchase-highlight.jpg', { locatorHighlight: purchaseTab });
      await purchaseTab.click({ force: true });
      await page.waitForTimeout(1000);
      await shot(page, dir, '06-purchase.jpg');
    }

    const priceTab = page.locator('button:has-text("Bảng giá")').first();
    if (await priceTab.count()) {
      await priceTab.click({ force: true });
      await page.waitForTimeout(1000);
      await shot(page, dir, '07-pricing.jpg');
    }

    const goodsTab = page.locator('button:has-text("Hàng hóa"):not(:has-text("Nhập"))').first();
    if (await goodsTab.count()) {
      await goodsTab.click({ force: true });
      await page.waitForTimeout(1000);
      const firstCb = page.locator('table tbody tr input[type="checkbox"]').first();
      if (await firstCb.count()) {
        await firstCb.click({ force: true });
        await page.waitForTimeout(600);
        await shot(page, dir, '08-label-select.jpg');
        const labelBtn = page.locator('button:has-text("tem"), button:has-text("Tem"), button:has-text("In tem")').first();
        if (await labelBtn.count()) {
          await shot(page, dir, '09-label-btn.jpg', { locatorHighlight: labelBtn });
        }
        await firstCb.click({ force: true });
      }
    }
  },
};

// ── Main ─────────────────────────────────────────────────────────────────────

(async () => {
  const targets = process.argv.slice(2);
  const toRun = targets.length
    ? Object.fromEntries(targets.map(t => [t, SCENARIOS[t]]).filter(([, v]) => v))
    : SCENARIOS;

  if (!Object.keys(toRun).length) {
    console.error('Không tìm thấy kịch bản:', targets.join(', '));
    console.error('Có sẵn:', Object.keys(SCENARIOS).join(', '));
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    await login(page);

    for (const [name, run] of Object.entries(toRun)) {
      console.log(`\n▶ Chụp: ${name}`);
      const articleDir = path.join(OUT_DIR, name);
      fs.mkdirSync(articleDir, { recursive: true });

      await page.goto(BASE_URL);
      await page.waitForTimeout(1000);
      await run(page, articleDir);
      console.log(`  ✅ Xong ${name} → ${articleDir}`);
    }
  } catch (err) {
    console.error('Lỗi:', err.message);
  } finally {
    await browser.close();
    console.log(`\n✅ Ảnh lưu tại: ${OUT_DIR}`);

    // Upload lên iMac (recursive để giữ cấu trúc thư mục)
    console.log(`\n📤 Upload ảnh lên iMac ${IMAC_HOST}...`);
    try {
      execSync(`ssh ${IMAC_HOST} "mkdir -p ${IMAC_ASSETS_DIR}"`, { stdio: 'inherit' });
      execSync(`scp -r ${OUT_DIR}/* ${IMAC_HOST}:${IMAC_ASSETS_DIR}/`, { stdio: 'inherit' });
      console.log('✅ Upload xong → iMac sẵn sàng serve ảnh qua /help/images/');
    } catch (e) {
      console.warn('⚠️  Upload thất bại (iMac offline?). Ảnh vẫn có ở local:', OUT_DIR);
    }
  }
})();
