/**
 * RhymeBook Logger Utility
 * Provides structured logging with different levels and environment-aware output
 */

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: string;
  data?: unknown;
}

class Logger {
  private isDevelopment: boolean;
  private logHistory: LogEntry[] = [];
  private maxHistorySize = 1000;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV !== 'production';
  }

  private createEntry(level: LogLevel, message: string, context?: string, data?: unknown): LogEntry {
    return {
      level,
      message,
      timestamp: new Date().toISOString(),
      context,
      data,
    };
  }

  private addToHistory(entry: LogEntry): void {
    this.logHistory.push(entry);
    if (this.logHistory.length > this.maxHistorySize) {
      this.logHistory = this.logHistory.slice(-this.maxHistorySize);
    }
  }

  private formatMessage(entry: LogEntry): string {
    const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}]`;
    const contextStr = entry.context ? ` [${entry.context}]` : '';
    return `${prefix}${contextStr} ${entry.message}`;
  }

  debug(message: string, context?: string, data?: unknown): void {
    const entry = this.createEntry(LogLevel.DEBUG, message, context, data);
    this.addToHistory(entry);
    
    if (this.isDevelopment) {
      console.debug(this.formatMessage(entry), data || '');
    }
  }

  info(message: string, context?: string, data?: unknown): void {
    const entry = this.createEntry(LogLevel.INFO, message, context, data);
    this.addToHistory(entry);
    
    if (this.isDevelopment) {
      console.info(this.formatMessage(entry), data || '');
    }
  }

  warn(message: string, context?: string, data?: unknown): void {
    const entry = this.createEntry(LogLevel.WARN, message, context, data);
    this.addToHistory(entry);
    
    console.warn(this.formatMessage(entry), data || '');
  }

  error(message: string, context?: string, data?: unknown): void {
    const entry = this.createEntry(LogLevel.ERROR, message, context, data);
    this.addToHistory(entry);
    
    // Always log errors, even in production
    console.error(this.formatMessage(entry), data || '');
  }

  getHistory(level?: LogLevel): LogEntry[] {
    if (level) {
      return this.logHistory.filter(entry => entry.level === level);
    }
    return [...this.logHistory];
  }

  clearHistory(): void {
    this.logHistory = [];
  }
}

// Singleton instance
export const logger = new Logger();

// Convenience functions for common use cases
export const logError = (message: string, context?: string, error?: unknown) => {
  logger.error(message, context, error);
};

export const logInfo = (message: string, context?: string, data?: unknown) => {
  logger.info(message, context, data);
};

export const logWarn = (message: string, context?: string, data?: unknown) => {
  logger.warn(message, context, data);
};

export const logDebug = (message: string, context?: string, data?: unknown) => {
  logger.debug(message, context, data);
};