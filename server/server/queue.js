// Compatibility shim: re-export the simple queue to satisfy legacy imports
// This ensures modules importing "./server/queue.js" continue to work.
export * from '../queue-simple.js';
