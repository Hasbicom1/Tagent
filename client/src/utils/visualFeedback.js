// Visual feedback for automation actions
let cursorElement = null;
let highlightOverlay = null;

// Create and show automation cursor
export function showCursor() {
  if (!cursorElement) {
    cursorElement = document.createElement('div');
    cursorElement.id = 'automation-cursor';
    cursorElement.style.cssText = `
      position: fixed;
      width: 20px;
      height: 20px;
      background: #ff4444;
      border: 2px solid #ffffff;
      border-radius: 50%;
      pointer-events: none;
      z-index: 999999;
      display: none;
      box-shadow: 0 0 10px rgba(255, 68, 68, 0.5);
      transition: all 0.1s ease;
    `;
    document.body.appendChild(cursorElement);
  }
  
  cursorElement.style.display = 'block';
}

// Hide automation cursor
export function hideCursor() {
  if (cursorElement) {
    cursorElement.style.display = 'none';
  }
}

// Highlight element with animation
export function highlightElement(element) {
  if (!element) return;
  
  // Remove existing highlight
  removeHighlight();
  
  // Create highlight overlay
  highlightOverlay = document.createElement('div');
  highlightOverlay.id = 'automation-highlight';
  highlightOverlay.style.cssText = `
    position: absolute;
    border: 3px solid #00ff00;
    background: rgba(0, 255, 0, 0.1);
    pointer-events: none;
    z-index: 999998;
    border-radius: 4px;
    box-shadow: 0 0 15px rgba(0, 255, 0, 0.5);
    animation: automation-pulse 0.5s ease-in-out;
  `;
  
  // Add pulse animation
  if (!document.getElementById('automation-styles')) {
    const style = document.createElement('style');
    style.id = 'automation-styles';
    style.textContent = `
      @keyframes automation-pulse {
        0% { transform: scale(1); opacity: 0.5; }
        50% { transform: scale(1.05); opacity: 1; }
        100% { transform: scale(1); opacity: 0.8; }
      }
      
      @keyframes automation-cursor-move {
        0% { transform: scale(1); }
        50% { transform: scale(1.2); }
        100% { transform: scale(1); }
      }
    `;
    document.head.appendChild(style);
  }
  
  // Position highlight over element
  const rect = element.getBoundingClientRect();
  highlightOverlay.style.left = (rect.left + window.scrollX) + 'px';
  highlightOverlay.style.top = (rect.top + window.scrollY) + 'px';
  highlightOverlay.style.width = rect.width + 'px';
  highlightOverlay.style.height = rect.height + 'px';
  
  document.body.appendChild(highlightOverlay);
  
  // Auto-remove after 2 seconds
  setTimeout(() => {
    removeHighlight();
  }, 2000);
}

// Remove element highlight
export function removeHighlight() {
  if (highlightOverlay) {
    highlightOverlay.remove();
    highlightOverlay = null;
  }
}

// Show typing animation
export function showTypingAnimation(element, text) {
  if (!element) return;
  
  // Create typing indicator
  const typingIndicator = document.createElement('div');
  typingIndicator.id = 'automation-typing';
  typingIndicator.style.cssText = `
    position: absolute;
    background: #333;
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    pointer-events: none;
    z-index: 999997;
    opacity: 0.8;
  `;
  
  typingIndicator.textContent = `Typing: "${text}"`;
  
  const rect = element.getBoundingClientRect();
  typingIndicator.style.left = (rect.left + window.scrollX) + 'px';
  typingIndicator.style.top = (rect.top + window.scrollY - 30) + 'px';
  
  document.body.appendChild(typingIndicator);
  
  // Remove after animation
  setTimeout(() => {
    typingIndicator.remove();
  }, 1000);
}

// Show automation status
export function showAutomationStatus(message, type = 'info') {
  const status = document.createElement('div');
  status.id = 'automation-status';
  status.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${type === 'error' ? '#ff4444' : type === 'success' ? '#00ff00' : '#333'};
    color: white;
    padding: 8px 16px;
    border-radius: 4px;
    z-index: 999999;
    font-size: 14px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.3);
  `;
  
  status.textContent = message;
  document.body.appendChild(status);
  
  // Auto-remove after 3 seconds
  setTimeout(() => {
    status.remove();
  }, 3000);
}

// Clean up all visual elements
export function cleanupVisuals() {
  hideCursor();
  removeHighlight();
  
  // Remove status messages
  const status = document.getElementById('automation-status');
  if (status) status.remove();
  
  const typing = document.getElementById('automation-typing');
  if (typing) typing.remove();
}
