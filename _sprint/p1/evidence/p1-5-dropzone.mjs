// P1.5 evidence: drag&drop + paste a file onto the chat composer → C2 attach path.
import { chromium } from '@playwright/test';
import { loginContext, OUT, BASE } from './_lib.mjs';

const SESSION = '132a6979-833e-4347-a45b-6866f24c490e';

async function makeDT(page, name, content) {
  return page.evaluateHandle(({ name, content }) => {
    const dt = new DataTransfer();
    dt.items.add(new File([content], name, { type: 'text/markdown' }));
    return dt;
  }, { name, content });
}

const browser = await chromium.launch();
const out = {};
try {
  const { page } = await loginContext(browser, { width: 1280, height: 900, theme: 'light' });
  page.setDefaultNavigationTimeout(150000);
  await page.goto(`${BASE}/dashboard/chat/${SESSION}`, { waitUntil: 'domcontentloaded', timeout: 150000 });
  const zone = page.locator('[data-testid="composer-dropzone"]');
  await zone.waitFor({ timeout: 90000 });

  // 1) Drag over → visible drop-zone highlight. Dispatch the drag events entirely
  // in page context so the DataTransfer's file items stay live (Playwright's
  // cross-context dispatchEvent drops item/type info on dragenter/over).
  await page.evaluate(() => {
    const el = document.querySelector('[data-testid="composer-dropzone"]');
    const dt = new DataTransfer();
    dt.items.add(new File(['# Notiz\nZeile'], 'notiz.md', { type: 'text/markdown' }));
    for (const type of ['dragenter', 'dragover']) {
      el.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt }));
    }
  });
  await page.waitForTimeout(300);
  out.dragActive = await zone.getAttribute('data-drag-active');
  out.dropHintVisible = await page.locator('[data-testid="composer-drop-hint"]').isVisible().catch(() => false);
  await page.screenshot({ path: `${OUT}/p15-drop-highlight.png` });

  // 2) Drop → attachment chip appears. (Playwright's handle DOES carry files on drop.)
  const dropDT = await makeDT(page, 'notiz.md', '# Notiz\n\nDies ist eine Testnotiz.\nZeile zwei.\nZeile drei.');
  await page.dispatchEvent('[data-testid="composer-dropzone"]', 'drop', { dataTransfer: dropDT });
  const chip = page.locator('[data-testid="composer-attachment"]');
  await chip.first().waitFor({ timeout: 10000 });
  await page.waitForTimeout(800); // let buildAttachment resolve (extracting→ready)
  out.chipAfterDrop = await chip.first().innerText().catch(() => null);
  out.chipCountAfterDrop = await chip.count();
  await page.screenshot({ path: `${OUT}/p15-dropped-chip.png` });

  // 3) Paste a file → another chip. Dispatch in page context so clipboardData
  // carries the file (Chromium supports the ClipboardEvent clipboardData init).
  await page.evaluate(() => {
    const el = document.querySelector('[data-testid="composer-dropzone"]');
    const dt = new DataTransfer();
    dt.items.add(new File(['# Eingefügt\nAus der Zwischenablage.'], 'eingefuegt.md', { type: 'text/markdown' }));
    el.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dt }));
  });
  await page.waitForTimeout(1000);
  out.chipCountAfterPaste = await chip.count();
  out.pasteChip = await chip.nth(1).innerText().catch(() => null);
  await page.screenshot({ path: `${OUT}/p15-pasted-chip.png` });

  console.log(JSON.stringify(out, null, 1));
} catch (e) {
  console.error('FAIL:', e.message, '\n', JSON.stringify(out));
  process.exitCode = 1;
} finally {
  await browser.close();
}
