/**
 * DOM ACTIONS - Real browser automation utilities
 * These functions provide actual DOM manipulation for in-browser automation
 */

// Import visual feedback functions
import { showCursor, hideCursor, highlightElement, removeHighlight } from './visualFeedback.js';

/**
 * Navigate to a URL
 */
export async function navigateTo(url) {
  console.log('🌐 DOM: Navigating to:', url);
  
  try {
    // Show loading state
    showCursor();
    
    // Navigate to URL
    window.location.href = url;
    
    // Wait for navigation to complete
    await new Promise(resolve => {
      const checkNavigation = () => {
        if (document.readyState === 'complete') {
          hideCursor();
          resolve();
        } else {
          setTimeout(checkNavigation, 100);
        }
      };
      checkNavigation();
    });
    
    console.log('✅ DOM: Navigation completed to:', url);
    return `Navigated to ${url}`;
  } catch (error) {
    hideCursor();
    console.error('❌ DOM: Navigation failed:', error);
    throw error;
  }
}

/**
 * Click an element
 */
export async function clickElement(selector) {
  console.log('🖱️ DOM: Clicking element:', selector);
  
  try {
    showCursor();
    
    // Find element
    const element = document.querySelector(selector);
    if (!element) {
      throw new Error(`Element not found: ${selector}`);
    }
    
    // Scroll into view
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await delay(300);
    
    // Highlight element
    highlightElement(element);
    await delay(200);
    
    // Click element
    element.click();
    
    // Cleanup
    removeHighlight();
    hideCursor();
    
    console.log('✅ DOM: Element clicked:', selector);
    return `Clicked ${selector}`;
  } catch (error) {
    removeHighlight();
    hideCursor();
    console.error('❌ DOM: Click failed:', error);
    throw error;
  }
}

/**
 * Type text into an element
 */
export async function typeText(selector, text) {
  console.log('⌨️ DOM: Typing text into:', selector);
  
  try {
    showCursor();
    
    // Find element
    const element = document.querySelector(selector);
    if (!element) {
      throw new Error(`Element not found: ${selector}`);
    }
    
    // Focus element
    element.focus();
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await delay(200);
    
    // Highlight element
    highlightElement(element);
    
    // Clear existing content
    element.value = '';
    
    // Type character by character
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      element.value += char;
      
      // Trigger input event
      element.dispatchEvent(new Event('input', { bubbles: true }));
      
      // Random delay between characters
      const delayMs = 50 + Math.random() * 100;
      await delay(delayMs);
    }
    
    // Trigger change event
    element.dispatchEvent(new Event('change', { bubbles: true }));
    
    // Cleanup
    removeHighlight();
    hideCursor();
    
    console.log('✅ DOM: Text typed into:', selector);
    return `Typed "${text}" into ${selector}`;
  } catch (error) {
    removeHighlight();
    hideCursor();
    console.error('❌ DOM: Type failed:', error);
    throw error;
  }
}

/**
 * Scroll the page
 */
export async function scrollPage(amount) {
  console.log('📜 DOM: Scrolling page by:', amount);
  
  try {
    showCursor();
    
    // Scroll the page
    window.scrollBy(0, amount);
    
    // Wait for scroll to complete
    await delay(300);
    
    hideCursor();
    
    console.log('✅ DOM: Page scrolled by:', amount);
    return `Scrolled page by ${amount}px`;
  } catch (error) {
    hideCursor();
    console.error('❌ DOM: Scroll failed:', error);
    throw error;
  }
}

/**
 * Wait for an element to appear
 */
export async function waitForElement(selector, timeout = 5000) {
  console.log('⏳ DOM: Waiting for element:', selector);
  
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    const element = document.querySelector(selector);
    if (element) {
      console.log('✅ DOM: Element found:', selector);
      return element;
    }
    await delay(100);
  }
  
  throw new Error(`Element not found within ${timeout}ms: ${selector}`);
}

/**
 * Get text from an element
 */
export async function getElementText(selector) {
  console.log('📄 DOM: Getting text from:', selector);
  
  try {
    const element = document.querySelector(selector);
    if (!element) {
      throw new Error(`Element not found: ${selector}`);
    }
    
    const text = element.textContent || element.value || '';
    console.log('✅ DOM: Text retrieved:', text.substring(0, 100) + '...');
    return text;
  } catch (error) {
    console.error('❌ DOM: Get text failed:', error);
    throw error;
  }
}

/**
 * Take a screenshot of the page
 */
export async function takeScreenshot() {
  console.log('📸 DOM: Taking screenshot');
  
  try {
    // Use html2canvas if available
    if (typeof html2canvas !== 'undefined') {
      const canvas = await html2canvas(document.body);
      const dataURL = canvas.toDataURL('image/png');
      console.log('✅ DOM: Screenshot taken with html2canvas');
      return dataURL;
    } else {
      // Fallback: create a simple screenshot representation
      const screenshot = {
        url: window.location.href,
        title: document.title,
        timestamp: new Date().toISOString(),
        dimensions: {
          width: window.innerWidth,
          height: window.innerHeight
        }
      };
      console.log('✅ DOM: Screenshot data created');
      return JSON.stringify(screenshot);
    }
  } catch (error) {
    console.error('❌ DOM: Screenshot failed:', error);
    throw error;
  }
}

/**
 * Utility function to delay execution
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}