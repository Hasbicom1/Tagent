/**
 * SIMPLE EKO BROWSER AGENT
 * Based on https://github.com/FellouAI/eko.git
 * REAL implementation - NO FAKE WRAPPERS
 */

import html2canvas from "html2canvas";

export class SimpleEkoBrowserAgent {
  public Name = "SimpleEkoBrowserAgent";
  public Description = "Real browser automation using Eko framework principles";

  /**
   * Take a screenshot of the current page
   */
  async screenshot(): Promise<{ imageBase64: string; imageType: "image/jpeg" | "image/png" }> {
    console.log('📸 SIMPLE EKO: Taking screenshot');
    
    const canvas = await html2canvas(document.documentElement || document.body, {
      useCORS: true,
      foreignObjectRendering: true,
    });
    
    const dataUrl = canvas.toDataURL("image/jpeg");
    const data = dataUrl.substring(dataUrl.indexOf("base64,") + 7);
    
    return {
      imageBase64: data,
      imageType: "image/jpeg",
    };
  }

  /**
   * Navigate to a URL
   */
  async navigateTo(url: string): Promise<{ url: string; title?: string }> {
    console.log('🌐 SIMPLE EKO: Navigating to:', url);
    
    let idx = location.href.indexOf("/", 10);
    let baseUrl = idx > -1 ? location.href.substring(0, idx) : location.href;
    
    if (url.startsWith("/")) {
      history.pushState(null, "", url);
    } else if (url.startsWith(baseUrl)) {
      history.pushState(null, "", url.substring(baseUrl.length));
    } else {
      // For external URLs, we'll use window.location
      window.location.href = url;
      await this.sleep(1000);
    }
    
    window.dispatchEvent(new PopStateEvent("popstate"));
    await this.sleep(200);
    
    return {
      url: location.href,
      title: document.title,
    };
  }

  /**
   * Execute JavaScript in the browser
   */
  async executeScript(func: (...args: any[]) => any, args: any[] = []): Promise<any> {
    console.log('🔧 SIMPLE EKO: Executing script');
    return func(...args);
  }

  /**
   * Extract page content
   */
  async extractPageContent(): Promise<{
    title: string;
    page_url: string;
    page_content: string;
  }> {
    console.log('📄 SIMPLE EKO: Extracting page content');
    
    const content = document.documentElement.outerHTML;
    const title = document.title;
    const url = location.href;
    
    return {
      title,
      page_url: url,
      page_content: content,
    };
  }

  /**
   * Click an element by selector
   */
  async clickElement(selector: string): Promise<void> {
    console.log('🖱️ SIMPLE EKO: Clicking element:', selector);
    
    const element = document.querySelector(selector);
    if (element) {
      (element as HTMLElement).click();
    } else {
      throw new Error(`Element not found: ${selector}`);
    }
  }

  /**
   * Type text into an element
   */
  async typeText(selector: string, text: string): Promise<void> {
    console.log('⌨️ SIMPLE EKO: Typing text into:', selector);
    
    const element = document.querySelector(selector) as HTMLInputElement;
    if (element) {
      element.focus();
      element.value = text;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      throw new Error(`Element not found: ${selector}`);
    }
  }

  /**
   * Scroll the page
   */
  async scrollPage(amount: number): Promise<void> {
    console.log('📜 SIMPLE EKO: Scrolling page by:', amount);
    
    window.scrollBy(0, amount);
    await this.sleep(300);
  }

  /**
   * Get current page info
   */
  async getCurrentPage(): Promise<{ url: string; title?: string }> {
    return {
      url: location.href,
      title: document.title,
    };
  }

  /**
   * Sleep utility
   */
  private sleep(time: number): Promise<void> {
    return new Promise((resolve) => setTimeout(() => resolve(), time));
  }
}

export default SimpleEkoBrowserAgent;
