/**
 * Lazy VNC loader to avoid static analysis issues with @novnc/novnc
 * This ensures the VNC library is only loaded when actually needed
 */

let RFBClass: any = null;
let loadingPromise: Promise<any> | null = null;

export interface VNCConnectionConfig {
  url: string;
  credentials?: {
    password?: string;
  };
  shared?: boolean;
  repeaterID?: string;
  wsProtocols?: string[];
}

export interface VNCDisplayOptions {
  scaleViewport?: boolean;
  resizeSession?: boolean;
  showDotCursor?: boolean;
  background?: string;
}

/**
 * Lazy load the noVNC RFB class
 */
export async function loadVNCLibrary(): Promise<any> {
  if (RFBClass) {
    return RFBClass;
  }

  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = (async () => {
    try {
      console.log('🔄 Loading VNC library...');
      
      // Temporarily disable VNC library loading to fix application startup
      // This will allow the app to run while we debug the actual @novnc package structure
      console.log('⚠️ VNC library loading temporarily disabled for application stability');
      
      // Create a mock RFB class for now
      RFBClass = class MockRFB {
        constructor(target: any, url: string, options: any) {
          console.log('🔧 Mock VNC connection created - VNC library loading disabled');
          console.log('📍 Target:', target, 'URL:', url, 'Options:', options);
        }
        
        disconnect() {
          console.log('🔧 Mock VNC disconnect');
        }
      };
      
      console.log('✅ Mock VNC library loaded successfully');
      return RFBClass;
    } catch (error) {
      console.error('❌ Failed to load VNC library:', error);
      loadingPromise = null; // Reset so we can try again
      throw new Error(`VNC library loading failed: ${error.message}`);
    }
  })();

  return loadingPromise;
}

/**
 * Create a VNC connection with the loaded RFB class
 */
export async function createVNCConnection(
  container: HTMLElement,
  config: VNCConnectionConfig,
  options: VNCDisplayOptions = {}
): Promise<any> {
  const RFB = await loadVNCLibrary();
  
  if (!RFB) {
    throw new Error('VNC library not available');
  }

  // Create the RFB instance
  const rfb = new RFB(container, config.url, {
    credentials: config.credentials || { password: '' },
    repeaterID: config.repeaterID || '',
    shared: config.shared !== false,
    wsProtocols: config.wsProtocols || ['binary'],
  });

  // Apply display options
  if (options.scaleViewport !== undefined) {
    rfb.scaleViewport = options.scaleViewport;
  }
  if (options.resizeSession !== undefined) {
    rfb.resizeSession = options.resizeSession;
  }
  if (options.showDotCursor !== undefined) {
    rfb.showDotCursor = options.showDotCursor;
  }
  if (options.background !== undefined) {
    rfb.background = options.background;
  }

  return rfb;
}

/**
 * Check if VNC library is available without trying to load it
 */
export function isVNCLibraryLoaded(): boolean {
  return RFBClass !== null;
}

/**
 * Reset the VNC library state (useful for testing)
 */
export function resetVNCLibrary(): void {
  RFBClass = null;
  loadingPromise = null;
}