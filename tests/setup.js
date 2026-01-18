import { beforeEach, vi } from 'vitest';

// Mock CSS.escape (not available in jsdom)
if (typeof CSS === 'undefined') {
  global.CSS = {
    escape: (str) => str.replace(/([^\w-])/g, '\\$1')
  };
}

// Mock GM functions
global.GM_getValue = vi.fn();
global.GM_setValue = vi.fn();
global.GM_deleteValue = vi.fn();
global.GM_registerMenuCommand = vi.fn();
global.GM_xmlhttpRequest = vi.fn();

global.GM = {
  getValue: vi.fn(),
  setValue: vi.fn(),
  deleteValue: vi.fn(),
  xmlHttpRequest: vi.fn()
};

// Reset mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
  if (typeof document !== 'undefined' && document.body) {
    document.body.innerHTML = '';
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.clear();
  }
});

// Helper to create mock storage
export const createMockStorage = () => {
  const store = new Map();
  return {
    get: vi.fn((key, defaultValue) => Promise.resolve(store.get(key) ?? defaultValue)),
    set: vi.fn((key, value) => { store.set(key, value); return Promise.resolve(true); }),
    delete: vi.fn((key) => { store.delete(key); return Promise.resolve(true); }),
    clear: () => store.clear(),
    _store: store
  };
};

// Helper to create test DOM
export const createTestDOM = (html) => {
  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.appendChild(container);
  return container;
};

// Mock OpenAI Responses API response
export const mockOpenAIResponse = (text) => ({
  id: 'resp_test123',
  object: 'response',
  status: 'completed',
  output: [{
    type: 'message',
    content: [{
      type: 'output_text',
      text: text
    }]
  }],
  usage: {
    input_tokens: 100,
    output_tokens: 50,
    total_tokens: 150
  }
});
