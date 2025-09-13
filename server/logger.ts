// Simple production logger - can be upgraded to pino later
interface LogLevel {
  error: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  info: (...args: any[]) => void;
  debug: (...args: any[]) => void;
}

const createLogger = (component?: string): LogLevel => {
  const prefix = component ? `[${component}]` : '';
  
  return {
    error: (...args) => console.error(`${new Date().toISOString()} ERROR ${prefix}`, ...args),
    warn: (...args) => console.warn(`${new Date().toISOString()} WARN ${prefix}`, ...args),
    info: (...args) => console.log(`${new Date().toISOString()} INFO ${prefix}`, ...args),
    debug: (...args) => {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`${new Date().toISOString()} DEBUG ${prefix}`, ...args);
      }
    }
  };
};

export const logger = createLogger();

// Security event logger
export const securityLogger = createLogger('security');

// Performance logger
export const performanceLogger = createLogger('performance');

// Add request ID middleware
export const addRequestId = (req: any, res: any, next: any) => {
  req.id = Math.random().toString(36).substring(2, 15);
  req.log = createLogger(`req-${req.id}`);
  next();
};