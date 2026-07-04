import { test, expect } from '@playwright/test';
import { loginAsTestCallback as loginAsRealTestUser, resolveTestProjectId, createProjectChatSession, dismissTour } from './helpers/auth';

/**
 * C1 — Dictation. Desktop-Chrome path uses the on-device Web Speech API; we inject
 * a synthetic SpeechRecognition (addInitScript, before app load) that emits a final
 * transcript on start(). Asserts the transcript lands in the composer and is NOT
 * auto-sent. The mic wiring, caret insertion, and no-keyboard-block are the units
 * under test; real-device iOS transcription is the founder's post-merge acceptance.
 */

const MOCK_TRANSCRIPT = 'baue mir eine landingpage';

// A minimal SpeechRecognition stand-in: start() fires a single final result.
const INSTALL_MOCK_SR = (transcript: string) => {
  class MockSR {
    lang = '';
    continuous = false;
    interimResults = false;
    maxAlternatives = 1;
    onstart: ((e: unknown) => void) | null = null;
    onresult: ((e: unknown) => void) | null = null;
    onerror: ((e: unknown) => void) | null = null;
    onend: ((e: unknown) => void) | null = null;
    start() {
      this.onstart?.({});
      setTimeout(() => {
        this.onresult?.({
          results: [Object.assign([{ transcript }], { isFinal: true })],
        });
        this.onend?.({});
      }, 50);
    }
    stop() {
      this.onend?.({});
    }
    abort() {}
  }
  (window as unknown as Record<string, unknown>).SpeechRecognition = MockSR;
  (window as unknown as Record<string, unknown>).webkitSpeechRecognition = MockSR;
};

test.describe('Dictation — Web Speech path (mocked)', { tag: '@local-only' }, () => {
  let projectId: string;
  let chatId: string;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await loginAsRealTestUser(page);
    projectId = await resolveTestProjectId(page);
    chatId = await createProjectChatSession(page, projectId);
    await page.close();
  });

  test('mic click inserts the transcript into the composer and does not auto-send', async ({ page }) => {
    await page.addInitScript(INSTALL_MOCK_SR, MOCK_TRANSCRIPT);
    await loginAsRealTestUser(page);
    await page.goto(`/dashboard/chat/${chatId}`);
    await page.waitForLoadState('networkidle');
    await dismissTour(page);

    const textarea = page.locator('textarea[data-chat-input]').first();
    await expect(textarea).toBeVisible({ timeout: 15000 });

    const mic = page.locator('[data-testid="composer-mic"]').first();
    await expect(mic).toBeVisible();
    await mic.click();

    // Transcript should appear in the composer…
    await expect(textarea).toHaveValue(new RegExp(MOCK_TRANSCRIPT, 'i'), { timeout: 5000 });
    // …and must NOT have been sent: no message bubble in the chat list carries it
    // (the composer sits outside .chat-scroll, so this excludes the textarea itself).
    await expect(page.locator('.chat-scroll').getByText(MOCK_TRANSCRIPT, { exact: false })).toHaveCount(0);
  });

  test('native keyboard typing is not swallowed by the composer', async ({ page }) => {
    await loginAsRealTestUser(page);
    await page.goto(`/dashboard/chat/${chatId}`);
    await page.waitForLoadState('networkidle');
    await dismissTour(page);

    const textarea = page.locator('textarea[data-chat-input]').first();
    await textarea.waitFor({ state: 'visible', timeout: 15000 });
    // Simulates the character-insertion path iOS native dictation uses (input events).
    await textarea.click();
    await textarea.pressSequentially('hallo welt', { delay: 10 });
    await expect(textarea).toHaveValue('hallo welt');
  });
});
