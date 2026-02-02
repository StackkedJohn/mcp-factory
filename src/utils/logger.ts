export const logger = {
  info: (message: string) => {
    console.log(`ℹ ${message}`);
  },

  success: (message: string) => {
    console.log(`✓ ${message}`);
  },

  error: (message: string) => {
    console.error(`✗ ${message}`);
  },

  warn: (message: string) => {
    console.warn(`⚠ ${message}`);
  },

  debug: (message: string) => {
    if (process.env.DEBUG) {
      console.log(`[DEBUG] ${message}`);
    }
  }
};
