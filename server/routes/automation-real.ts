import { chromium } from 'playwright';

function extractUrl(instruction: string): string | null {
  const match = instruction.match(/https?:\/\/[^\s]+/i);
  return match ? match[0] : null;
}

export async function realBrowserAutomation(instruction: string): Promise<{
  success: true;
  screenshot: string;
  url: string;
}> {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();

    const url = extractUrl(instruction);
    if (url) {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
    } else {
      await page.goto('about:blank');
    }

    const screenshotBinary = await page.screenshot({ type: 'png' });
    const screenshot = Buffer.from(screenshotBinary).toString('base64');

    return {
      success: true,
      screenshot,
      url: page.url()
    };
  } finally {
    await browser.close();
  }
}

