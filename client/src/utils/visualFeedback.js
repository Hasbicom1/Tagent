/**
 * VISUAL FEEDBACK - Real browser automation visual effects
 * These functions provide visual feedback during automation
 */

/**
 * Show cursor overlay
 */
export function showCursor() {
  let cursor = document.getElementById('automation-cursor');
  if (!cursor) {
    cursor = document.createElement('div');
    cursor.id = 'automation-cursor';
    cursor.style.cssText = `
      position: fixed;
      width: 20px;
      height: 20px;
      background: #ff0000;
      border-radius: 50%;
      z-index: 999999;
      pointer-events: none;
      display: none;
      box-shadow: 0 0 10px rgba(255, 0, 0, 0.5);
      transition: all 0.2s ease;
    `;
    document.body.appendChild(cursor);
  }
  cursor.style.display = 'block';
}

/**
 * Hide cursor overlay
 */
export function hideCursor() {
  const cursor = document.getElementById('automation-cursor');
  if (cursor) {
    cursor.style.display = 'none';
  }
}

/**
 * Move cursor to specific coordinates
 */
export async function moveCursorTo(x, y) {
  const cursor = document.getElementById('automation-cursor');
  if (cursor) {
    cursor.style.left = x + 'px';
    cursor.style.top = y + 'px';
    cursor.style.display = 'block';
    await delay(100);
  }
}

/**
 * Highlight an element
 */
export function highlightElement(element) {
  // Remove existing highlights
  removeHighlight();
  
  // Add highlight class
  element.classList.add('automation-highlight');
  
  // Add CSS for highlight
  if (!document.getElementById('automation-highlight-style')) {
    const style = document.createElement('style');
    style.id = 'automation-highlight-style';
    style.textContent = `
      .automation-highlight {
        outline: 3px solid #ff0000 !important;
        outline-offset: 2px !important;
        background-color: rgba(255, 0, 0, 0.1) !important;
        animation: automation-pulse 1s infinite !important;
        position: relative !important;
        z-index: 999998 !important;
      }
      
      @keyframes automation-pulse {
        0% { outline-color: #ff0000; }
        50% { outline-color: #ff6666; }
        100% { outline-color: #ff0000; }
      }
    `;
    document.head.appendChild(style);
  }
}

/**
 * Remove highlight from elements
 */
export function removeHighlight() {
  // Remove highlight class from all elements
  const highlighted = document.querySelectorAll('.automation-highlight');
  highlighted.forEach(el => el.classList.remove('automation-highlight'));
}

/**
 * Show typing animation
 */
export async function showTypingAnimation(element, text) {
  if (!element) return;
  
  // Focus element
  element.focus();
  
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
}

/**
 * Show click animation
 */
export async function showClickAnimation(element) {
  if (!element) return;
  
  // Add click effect
  element.classList.add('automation-click');
  
  // Add CSS for click effect
  if (!document.getElementById('automation-click-style')) {
    const style = document.createElement('style');
    style.id = 'automation-click-style';
    style.textContent = `
      .automation-click {
        transform: scale(0.95) !important;
        transition: transform 0.1s ease !important;
      }
    `;
    document.head.appendChild(style);
  }
  
  await delay(100);
  
  // Remove click effect
  element.classList.remove('automation-click');
}

/**
 * Show scroll animation
 */
export async function showScrollAnimation(amount) {
  // Smooth scroll
  window.scrollBy({
    top: amount,
    behavior: 'smooth'
  });
  
  // Wait for scroll to complete
  await delay(500);
}

/**
 * Show navigation animation
 */
export async function showNavigationAnimation(url) {
  // Show loading state
  const loading = document.createElement('div');
  loading.id = 'automation-loading';
  loading.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 20px;
    border-radius: 10px;
    z-index: 999999;
    font-family: monospace;
    font-size: 14px;
  `;
  loading.textContent = `Navigating to ${url}...`;
  document.body.appendChild(loading);
  
  // Wait a bit
  await delay(1000);
  
  // Remove loading state
  if (loading.parentNode) {
    loading.parentNode.removeChild(loading);
  }
}

/**
 * Show automation status message
 */
export function showAutomationStatus(message, type = 'info') {
  // Remove existing status
  cleanupVisuals();
  
  const status = document.createElement('div');
  status.id = 'automation-status';
  status.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${type === 'error' ? '#ff4444' : type === 'success' ? '#44ff44' : '#4444ff'};
    color: white;
    padding: 10px 15px;
    border-radius: 5px;
    z-index: 999999;
    font-family: monospace;
    font-size: 12px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
    max-width: 300px;
    word-wrap: break-word;
  `;
  status.textContent = message;
  document.body.appendChild(status);
  
  // Auto-remove after 3 seconds
  setTimeout(() => {
    if (status.parentNode) {
      status.parentNode.removeChild(status);
    }
  }, 3000);
}

/**
 * Show highlight on element
 */
export function showHighlight(selector) {
  const element = document.querySelector(selector);
  if (element) {
    element.style.outline = '3px solid #00ff00';
    element.style.outlineOffset = '2px';
    element.style.transition = 'outline 0.3s ease';
  }
}


/**
 * Show typing animation
 */
export function showTyping(selector, text) {
  const element = document.querySelector(selector);
  if (element) {
    element.style.border = '2px solid #00ff00';
    element.style.boxShadow = '0 0 10px rgba(0, 255, 0, 0.5)';
    element.style.transition = 'all 0.3s ease';
  }
}

/**
 * Hide typing animation
 */
export function hideTyping() {
  const elements = document.querySelectorAll('[style*="border: 2px solid #00ff00"]');
  elements.forEach(el => {
    el.style.border = '';
    el.style.boxShadow = '';
  });
}

/**
 * Move cursor to element
 */
export async function moveCursor(selector) {
  const element = document.querySelector(selector);
  if (element) {
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    await moveCursorTo(x, y);
  }
}

/**
 * Cleanup all visual elements
 */
export function cleanupVisuals() {
  // Remove status
  const status = document.getElementById('automation-status');
  if (status && status.parentNode) {
    status.parentNode.removeChild(status);
  }
  
  // Remove cursor
  hideCursor();
  
  // Remove highlights
  removeHighlight();
  
  // Remove loading
  const loading = document.getElementById('automation-loading');
  if (loading && loading.parentNode) {
    loading.parentNode.removeChild(loading);
  }
}

/**
 * Utility function to delay execution
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}