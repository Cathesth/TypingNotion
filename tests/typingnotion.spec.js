const { test, expect } = require('@playwright/test');

async function openApp(page) {
  await page.goto('./index.html');
  await expect(page.locator('h1')).toContainText('TypingNotion');
}

test('앱이 열리고 핵심 입력 UI가 보인다', async ({ page }) => {
  await openApp(page);
  await expect(page.locator('#tab-url')).toBeVisible();
  await expect(page.locator('#tab-text')).toBeVisible();
  await expect(page.locator('#version-badge')).toContainText(/^v\d+\./);
});

test('직접 입력으로 타이핑을 완료할 수 있다', async ({ page }) => {
  await openApp(page);

  await page.click('#tab-text');
  await page.fill('#source-ta', 'abc');
  await expect(page.locator('#start-btn-text')).toBeEnabled();
  await page.click('#start-btn-text');

  await expect(page.locator('#s-typing')).toBeVisible();
  await page.keyboard.type('abc');
  await expect(page.locator('#s-results')).toBeVisible();
  await expect(page.locator('#r-acc')).toContainText('100%');
  await expect(page.locator('#r-errs')).toContainText('0');
});

test('자동 타이핑 옵션이 공백과 기호를 통과시킨다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.metadata.target !== 'beta', '자동 타이핑은 beta 기능입니다.');

  await page.addInitScript(() => {
    localStorage.setItem('typing-settings', JSON.stringify({
      skipSymbols: true,
      autoSpace: true,
      autoNewline: false,
      autoSymbol: true,
      autoEnglish: false,
      autoKorean: false,
      onlyEnglish: false,
      onlyKorean: false
    }));
  });
  await openApp(page);

  await page.click('#tab-text');
  await page.fill('#source-ta', 'a b!');
  await page.click('#start-btn-text');
  await page.keyboard.type('ab');

  await expect(page.locator('#s-results')).toBeVisible();
  await expect(page.locator('#r-errs')).toContainText('0');
});

test('캐시된 노션 메모를 네트워크 없이 불러올 수 있다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.metadata.target !== 'beta', 'URL 캐시는 beta 기능입니다.');

  const url = 'https://example.notion.site/Test-Page';
  await page.addInitScript(([cacheUrl]) => {
    localStorage.setItem('typing-cache-enabled', 'true');
    localStorage.setItem(`tn-cache:${cacheUrl}`, JSON.stringify({
      title: 'Cached QA Page',
      text: 'cached text',
      headings: [{ level: 1, text: 'Cached Heading', charIndex: -1 }],
      savedAt: Date.now()
    }));
  }, [url]);
  await openApp(page);

  await page.fill('#url-inp', url);
  await page.click('#fetch-btn');
  await expect(page.locator('#cache-modal')).toBeVisible();
  await page.click('button:has-text("저장된 내용 사용")');

  await expect(page.locator('#preview-wrap')).toBeVisible();
  await expect(page.locator('#preview-ta')).toHaveValue(/cached text/);
  await expect(page.locator('#fetch-status')).toContainText('캐시');
});

test('production/beta 이동 링크가 존재한다', async ({ page }, testInfo) => {
  await openApp(page);
  const target = testInfo.project.metadata.target;
  const expectedHref = target === 'beta' ? /typingnotion\.vercel\.app/ : /git-beta|github|vercel/;
  await expect(page.locator('a[href*="vercel.app"]').first()).toHaveAttribute('href', expectedHref);
});
