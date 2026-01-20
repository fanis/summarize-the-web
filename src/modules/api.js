/**
 * OpenAI API functions for Summarize The Web
 */

import { CFG, MODEL_OPTIONS, STORAGE_KEYS, DEFAULT_PRICING, STYLE_INSTRUCTIONS, MAX_OUTPUT_TOKENS } from './config.js';
import { log } from './utils.js';

// API token usage tracking
export let API_TOKENS = {
    digest: { input: 0, output: 0, calls: 0 }
};

// API Pricing configuration
export let PRICING = { ...DEFAULT_PRICING };

/**
 * Initialize API tracking from storage
 */
export async function initApiTracking(storage) {
    try {
        const stored = await storage.get(STORAGE_KEYS.API_TOKENS, '');
        if (stored) API_TOKENS = JSON.parse(stored);
    } catch {}

    try {
        const stored = await storage.get(STORAGE_KEYS.PRICING, '');
        if (stored) PRICING = JSON.parse(stored);
    } catch {}

    // Load saved model preference
    try {
        const stored = await storage.get(STORAGE_KEYS.MODEL, '');
        if (stored && MODEL_OPTIONS[stored]) {
            CFG.model = stored;
            PRICING.model = stored;
            PRICING.inputPer1M = MODEL_OPTIONS[stored].inputPer1M;
            PRICING.outputPer1M = MODEL_OPTIONS[stored].outputPer1M;
        }
    } catch {}
}

/**
 * Build API headers
 */
export function apiHeaders(key) {
    return {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
    };
}

/**
 * Make XHR POST request (for userscript cross-origin)
 */
export function xhrPost(url, data, headers = {}) {
    return new Promise((resolve, reject) => {
        const api = (typeof GM !== 'undefined' && GM.xmlHttpRequest) ? GM.xmlHttpRequest : GM_xmlhttpRequest;
        api({
            method: 'POST',
            url,
            data,
            headers,
            onload: (r) => {
                if (r.status >= 200 && r.status < 300) return resolve(r.responseText);
                const err = new Error(`HTTP ${r.status}`);
                err.status = r.status;
                err.body = r.responseText || '';
                reject(err);
            },
            onerror: (e) => { const err = new Error((e && e.error) || 'Network error'); err.status = 0; reject(err); },
            timeout: 60000,
            ontimeout: () => { const err = new Error('Request timeout'); err.status = 0; reject(err); },
        });
    });
}

/**
 * Make XHR GET request
 */
export function xhrGet(url, headers = {}) {
    return new Promise((resolve, reject) => {
        const api = (typeof GM !== 'undefined' && GM.xmlHttpRequest) ? GM.xmlHttpRequest : GM_xmlhttpRequest;
        api({
            method: 'GET',
            url,
            headers,
            onload: (r) => {
                if (r.status >= 200 && r.status < 300) return resolve(r.responseText);
                const err = new Error(`HTTP ${r.status}`);
                err.status = r.status;
                err.body = r.responseText || '';
                reject(err);
            },
            onerror: (e) => { const err = new Error((e && e.error) || 'Network error'); err.status = 0; reject(err); },
            timeout: 30000,
            ontimeout: () => { const err = new Error('Request timeout'); err.status = 0; reject(err); },
        });
    });
}

/**
 * Extract output text from API response
 */
export function extractOutputText(data) {
    if (typeof data.output_text === 'string') return data.output_text;
    if (Array.isArray(data.output)) {
        const parts = [];
        for (const msg of data.output) {
            if (Array.isArray(msg.content)) {
                for (const c of msg.content) {
                    if (typeof c.text === 'string') parts.push(c.text);
                    else if (c.type === 'output_text' && typeof c.text === 'string') parts.push(c.text);
                }
            }
        }
        if (parts.length) return parts.join('');
    }
    if (Array.isArray(data.choices)) return data.choices.map((ch) => ch.message?.content || '').join('\n');
    return '';
}

/**
 * Update API token usage stats
 */
export function updateApiTokens(storage, type, usage) {
    if (!usage) return;

    const inputTokens = usage.input_tokens || usage.prompt_tokens || 0;
    const outputTokens = usage.output_tokens || usage.completion_tokens || 0;

    if (inputTokens === 0 && outputTokens === 0) {
        log('WARNING: No token data found in usage object:', usage);
        return;
    }

    API_TOKENS[type].input += inputTokens;
    API_TOKENS[type].output += outputTokens;
    API_TOKENS[type].calls += 1;

    log(`${type} tokens: +${inputTokens} input, +${outputTokens} output (total: ${API_TOKENS[type].input + API_TOKENS[type].output})`);

    clearTimeout(updateApiTokens._timer);
    updateApiTokens._timer = setTimeout(() => {
        storage.set(STORAGE_KEYS.API_TOKENS, JSON.stringify(API_TOKENS));
        log('API tokens updated and saved:', API_TOKENS);
    }, 1000);
}

/**
 * Reset API token stats
 */
export async function resetApiTokens(storage) {
    API_TOKENS = {
        digest: { input: 0, output: 0, calls: 0 }
    };
    await storage.set(STORAGE_KEYS.API_TOKENS, JSON.stringify(API_TOKENS));
    log('API token stats reset');
}

/**
 * Calculate estimated API cost
 */
export function calculateApiCost() {
    const inputCost = API_TOKENS.digest.input * PRICING.inputPer1M / 1_000_000;
    const outputCost = API_TOKENS.digest.output * PRICING.outputPer1M / 1_000_000;
    return inputCost + outputCost;
}

/**
 * Update pricing configuration
 */
export async function updatePricing(storage, newPricing) {
    PRICING.inputPer1M = newPricing.inputPer1M;
    PRICING.outputPer1M = newPricing.outputPer1M;
    PRICING.lastUpdated = new Date().toISOString().split('T')[0];
    await storage.set(STORAGE_KEYS.PRICING, JSON.stringify(PRICING));
}

/**
 * Reset pricing to defaults
 */
export async function resetPricingToDefaults(storage) {
    Object.assign(PRICING, DEFAULT_PRICING);
    await storage.set(STORAGE_KEYS.PRICING, JSON.stringify(PRICING));
}

/**
 * Call OpenAI API to digest text
 */
export async function digestText(storage, text, mode, prompt, styleLevel, cacheGet, cacheSet, openKeyDialog, openInfo) {
    const KEY = await storage.get(STORAGE_KEYS.OPENAI_KEY, '');
    if (!KEY) {
        openKeyDialog('OpenAI API key missing.');
        throw Object.assign(new Error('API key missing'), { status: 401 });
    }

    // Check cache first
    const cached = cacheGet(text, mode);
    if (cached) {
        log(`Using cached summary for ${mode} mode`);
        return cached.result;
    }

    const safeInput = text.replace(/[\u2028\u2029]/g, ' ');

    // Get the actual API model name (not the UI identifier)
    const apiModelName = MODEL_OPTIONS[CFG.model]?.apiModel || CFG.model;

    // Append style instructions to prompt
    const styleInstruction = STYLE_INSTRUCTIONS[styleLevel] || '';
    const fullPrompt = prompt + styleInstruction;

    const requestBody = {
        model: apiModelName,
        max_output_tokens: mode.includes('small') ? MAX_OUTPUT_TOKENS.small : MAX_OUTPUT_TOKENS.large,
        instructions: fullPrompt,
        input: safeInput
    };

    // GPT-5 models are reasoning models - minimize reasoning for summarization
    if (apiModelName.startsWith('gpt-5')) {
        requestBody.reasoning = { effort: 'minimal' };
    }

    // Add service_tier for priority models
    if (MODEL_OPTIONS[CFG.model]?.priority) {
        requestBody.service_tier = 'priority';
    }

    const body = JSON.stringify(requestBody);

    const resText = await xhrPost('https://api.openai.com/v1/responses', body, apiHeaders(KEY));
    const payload = JSON.parse(resText);
    log('API response status:', payload.status, 'usage:', payload.usage);

    if (payload.usage) {
        updateApiTokens(storage, 'digest', payload.usage);
    }

    // Check for incomplete response
    if (payload.status === 'incomplete') {
        const reason = payload.incomplete_details?.reason || 'unknown';
        let errorMsg = 'API response incomplete';
        if (reason === 'max_output_tokens') {
            const reasoningTokens = payload.usage?.output_tokens_details?.reasoning_tokens || 0;
            if (reasoningTokens > 0) {
                errorMsg = `Model used all tokens on reasoning (${reasoningTokens} tokens). Try a different model or increase max_output_tokens in config.js`;
            } else {
                errorMsg = 'Response exceeded max_output_tokens limit. Try selecting less text or increase the limit in config.js';
            }
        }
        throw Object.assign(new Error(errorMsg), { status: 400, isIncomplete: true });
    }

    const outStr = extractOutputText(payload);
    log('Extracted output:', outStr ? outStr.substring(0, 100) + '...' : 'null');
    if (!outStr) throw Object.assign(new Error('No output from API. The model returned an empty response.'), { status: 400 });

    // Strip markdown code fences if present
    const cleaned = outStr.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();

    // Try to parse as JSON (API might return array or plain text)
    let result;
    try {
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed)) {
            result = parsed.join('\n\n');
        } else if (typeof parsed === 'string') {
            result = parsed;
        } else {
            result = cleaned;
        }
    } catch (e) {
        result = cleaned;
    }

    await cacheSet(text, mode, result);
    return result;
}

/**
 * Handle API errors with friendly messages
 */
export function friendlyApiError(err, openKeyDialog, openInfo) {
    log('API error:', err?.status, err?.message);
    const s = err?.status || 0;
    if (s === 401) { openKeyDialog('Unauthorized (401). Please enter a valid OpenAI key.'); return; }
    if (s === 429) { openInfo('Rate limited by API (429). Try again in a minute.'); return; }
    if (err.isIncomplete) { openInfo(err.message); return; }
    if (s === 400) { openInfo(err.message || 'Bad request (400). The API could not parse the text. Try selecting less text.'); return; }
    openInfo(`Unknown error${s ? ' (' + s + ')' : ''}. Check your network or try again.`);
}
