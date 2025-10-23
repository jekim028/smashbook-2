/**
 * Logger utility for Share Extension debugging
 * Helps track share extension lifecycle and data flow
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: any;
}

class Logger {
  private logs: LogEntry[] = [];
  private maxLogs = 100;
  private isDevelopment = __DEV__;

  log(level: LogLevel, message: string, data?: any) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
    };

    this.logs.push(entry);
    
    // Keep only last maxLogs entries
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Console output in development
    if (this.isDevelopment) {
      const prefix = `[ShareExtension ${level.toUpperCase()}]`;
      const logData = data ? JSON.stringify(data, null, 2) : '';
      
      switch (level) {
        case 'error':
          console.error(prefix, message, logData);
          break;
        case 'warn':
          console.warn(prefix, message, logData);
          break;
        case 'debug':
          console.debug(prefix, message, logData);
          break;
        default:
          console.log(prefix, message, logData);
      }
    }
  }

  info(message: string, data?: any) {
    this.log('info', message, data);
  }

  warn(message: string, data?: any) {
    this.log('warn', message, data);
  }

  error(message: string, data?: any) {
    this.log('error', message, data);
  }

  debug(message: string, data?: any) {
    this.log('debug', message, data);
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  clearLogs() {
    this.logs = [];
  }

  // Get logs as formatted string for debugging
  getLogsAsString(): string {
    return this.logs
      .map(log => `[${log.timestamp}] ${log.level.toUpperCase()}: ${log.message}`)
      .join('\n');
  }
}

// Export singleton instance
export const logger = new Logger();
export default logger;

