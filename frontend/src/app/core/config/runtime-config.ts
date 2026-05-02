declare global {
  interface Window {
    __env?: {
      API_BASE?: string;
    };
  }
}

export const runtimeConfig = {
  apiBase: window.__env?.API_BASE || 'http://localhost:8000',
};

export {};
