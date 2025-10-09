// DOM automation actions with visible feedback
import { showCursor, hideCursor, highlightElement, removeHighlight } from './visualFeedback';

// Security: Only allow automation on our domain
const ALLOWED_DOMAINS = [
  'localhost',
  '127.0.0.1',
  'onedollaragent.ai',
  'www.onedollaragent.ai'
];

function validateDomain() {
  const hostname = window.location.hostname;
  const isAllowed = ALLOWED_DOMAINS.some(domain => 
    hostname === domain || hostname.endsWith('.' + domain)
  );
  
  if (!isAllowed) {
    throw new Error(`Automation not allowed on domain: ${hostname}`);
  }
}

// Navigate to URL
export async function navigateTo(url) {
  validateDomain();
  console.log('🧭 Navigating to:', url);
  
  // Show loading cursor
  showCursor();
  
  try {
    window.location.href = url;
    return { success: true, url };
  } catch (error) {
    hideCursor();
    throw new Error(`Navigation failed: ${error.message}`);
  }
}

// Click element with visual feedback
export async function clickElement(selector) {
  validateDomain();
  console.log('🖱️ Clicking element:', selector);
  
  const element = document.querySelector(selector);
  if (!element) {
    throw new Error(`Element not found: ${selector}`);
  }
  
  // Scroll element into view
  element.scrollIntoView({ 
    behavior: "smooth", 
    block: "center",
    inline: "center"
  });
  
  // Wait for scroll to complete
  await new Promise(resolve => setTimeout(resolve, 300));
  
  // Show cursor and highlight
  showCursor();
  highlightElement(element);
  
  // Simulate mouse movement to element
  const rect = element.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  
  // Move cursor to element
  await moveCursorTo(centerX, centerY);
  
  // Wait a moment
  await new Promise(resolve => setTimeout(resolve, 200));
  
  // Click the element
  element.click();
  
  // Remove highlight and hide cursor
  removeHighlight(element);
  hideCursor();
  
  return { success: true, selector, action: 'click' };
}

// Type text with character-by-character animation
export async function typeText(selector, text) {
  validateDomain();
  console.log('⌨️ Typing text:', text, 'into:', selector);
  
  const element = document.querySelector(selector);
  if (!element) {
    throw new Error(`Element not found: ${selector}`);
  }
  
  // Focus the element
  element.focus();
  element.scrollIntoView({ behavior: "smooth", block: "center" });
  
  // Wait for focus
  await new Promise(resolve => setTimeout(resolve, 200));
  
  // Clear existing content
  element.value = "";
  
  // Show cursor and highlight
  showCursor();
  highlightElement(element);
  
  // Type character by character
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    element.value += char;
    
    // Trigger input event
    element.dispatchEvent(new Event('input', { bubbles: true }));
    
    // Random delay between characters (50-150ms)
    const delay = 50 + Math.random() * 100;
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  
  // Trigger change event
  element.dispatchEvent(new Event('change', { bubbles: true }));
  
  // Remove highlight and hide cursor
  removeHighlight(element);
  hideCursor();
  
  return { success: true, selector, text, action: 'type' };
}

// Scroll page
export async function scrollPage(y) {
  validateDomain();
  console.log('📜 Scrolling to:', y);
  
  showCursor();
  
  // Smooth scroll to position
  window.scrollTo({ 
    top: y, 
    behavior: "smooth" 
  });
  
  // Wait for scroll to complete
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  hideCursor();
  
  return { success: true, scrollY: y, action: 'scroll' };
}

// Move cursor to specific coordinates
async function moveCursorTo(x, y) {
  const cursor = document.getElementById('automation-cursor');
  if (cursor) {
    cursor.style.left = x + 'px';
    cursor.style.top = y + 'px';
    cursor.style.display = 'block';
    
    // Animate movement
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

// Wait for element to be visible
export async function waitForElement(selector, timeout = 5000) {
  validateDomain();
  console.log('⏳ Waiting for element:', selector);
  
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const checkElement = () => {
      const element = document.querySelector(selector);
      if (element && element.offsetParent !== null) {
        resolve(element);
      } else if (Date.now() - startTime > timeout) {
        reject(new Error(`Element not found within ${timeout}ms: ${selector}`));
      } else {
        setTimeout(checkElement, 100);
      }
    };
    
    checkElement();
  });
}

// Get element text content
export async function getElementText(selector) {
  validateDomain();
  console.log('📖 Getting text from:', selector);
  
  const element = document.querySelector(selector);
  if (!element) {
    throw new Error(`Element not found: ${selector}`);
  }
  
  return { 
    success: true, 
    selector, 
    text: element.textContent || element.value,
    action: 'getText' 
  };
}

// Take screenshot of current page
export async function takeScreenshot() {
  validateDomain();
  console.log('📸 Taking screenshot');
  
  try {
    // Import html2canvas dynamically
    const html2canvas = (await import('html2canvas')).default;
    
    if (html2canvas) {
      const canvas = await html2canvas(document.body, {
        useCORS: true,
        allowTaint: true,
        scale: 0.5 // Reduce size for performance
      });
      const dataURL = canvas.toDataURL('image/png');
      return { success: true, screenshot: dataURL, action: 'screenshot' };
    } else {
      throw new Error('html2canvas not available');
    }
  } catch (error) {
    console.warn('Screenshot failed, returning page info:', error.message);
    // Fallback: return page info
    return { 
      success: true, 
      screenshot: null,
      pageInfo: {
        url: window.location.href,
        title: document.title,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        }
      },
      action: 'screenshot' 
    };
  }
}
