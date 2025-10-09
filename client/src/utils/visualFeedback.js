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
 * Utility function to delay execution
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}