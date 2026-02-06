/**
 * Settings dialogs and management for Summarize The Web
 */

import { UI_ATTR, STORAGE_KEYS, MODEL_OPTIONS, SIMPLIFICATION_LEVELS, DEFAULT_PROMPTS } from './config.js';
import { parseLines, escapeHtml } from './utils.js';
import { xhrGet, API_TOKENS, PRICING, calculateApiCost } from './api.js';

/**
 * Polymorphic editor for lists, secrets, domains, and info display
 */
export function openEditor({ title, hint = 'One item per line', mode = 'list', initial = [], globalItems = [], onSave, onValidate }) {
    const host = document.createElement('div');
    host.setAttribute(UI_ATTR, '');
    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `
        .wrap{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.45);
              display:flex;align-items:center;justify-content:center}
        .modal{background:#fff;max-width:680px;width:92%;border-radius:10px;
               box-shadow:0 10px 40px rgba(0,0,0,.35);padding:16px 16px 12px;box-sizing:border-box}
        .modal h3{margin:0 0 8px;font:600 16px/1.2 system-ui,sans-serif}
        .section-label{font:600 13px/1.2 system-ui,sans-serif;margin:8px 0 4px;color:#444}
        textarea{width:100%;height:220px;resize:vertical;padding:10px;box-sizing:border-box;
                 font:13px/1.4 ui-monospace,Consolas,monospace;border:1px solid #ccc;border-radius:4px}
        textarea.readonly{background:#f5f5f5;color:#666;height:120px}
        textarea.editable{height:180px}
        .row{display:flex;gap:8px;align-items:center}
        input[type=password],input[type=text]{flex:1;padding:10px;border-radius:8px;border:1px solid #ccc;
                 font:14px/1.3 ui-monospace,Consolas,monospace;box-sizing:border-box}
        .actions{display:flex;gap:8px;justify-content:flex-end;margin-top:10px}
        .actions button{padding:8px 12px;border-radius:8px;border:1px solid #d0d0d0;background:#f6f6f6;cursor:pointer}
        .actions .save{background:#667eea;color:#fff;border-color:#667eea}
        .actions .test{background:#34a853;color:#fff;border-color:#34a853}
        .hint{margin:8px 0 0;color:#666;font:12px/1.2 system-ui,sans-serif}
    `;
    const wrap = document.createElement('div');
    wrap.className = 'wrap';
    const bodyList = `<textarea spellcheck="false" autocomplete="off" autocapitalize="off" autocorrect="off">${
        Array.isArray(initial) ? initial.join('\n') : ''
    }</textarea>`;
    const bodyDomain = `
        <div class="section-label">Global settings (read-only):</div>
        <textarea class="readonly" readonly spellcheck="false">${Array.isArray(globalItems) ? globalItems.join('\n') : ''}</textarea>
        <div class="section-label">Domain-specific additions (editable):</div>
        <textarea class="editable" spellcheck="false" autocomplete="off" autocapitalize="off" autocorrect="off">${Array.isArray(initial) ? initial.join('\n') : ''}</textarea>
    `;
    const bodySecret = `
        <div class="row">
            <input id="sec" type="password" placeholder="sk-..." autocomplete="off" />
            <button id="toggle" title="Show/Hide">👁</button>
        </div>`;
    const bodyInfo = `<textarea class="readonly" readonly spellcheck="false" style="height:auto;min-height:60px;max-height:300px;">${
        Array.isArray(initial) ? initial.join('\n') : String(initial)
    }</textarea>`;

    let bodyContent, actionsContent;
    if (mode === 'info') {
        bodyContent = bodyInfo;
        actionsContent = '<button class="cancel">Close</button>';
    } else if (mode === 'secret') {
        bodyContent = bodySecret;
        actionsContent = (onValidate ? '<button class="test">Validate</button>' : '') + '<button class="save">Save</button><button class="cancel">Cancel</button>';
    } else if (mode === 'domain') {
        bodyContent = bodyDomain;
        actionsContent = '<button class="save">Save</button><button class="cancel">Cancel</button>';
    } else {
        bodyContent = bodyList;
        actionsContent = '<button class="save">Save</button><button class="cancel">Cancel</button>';
    }

    wrap.innerHTML = `
        <div class="modal" role="dialog" aria-modal="true" aria-label="${title}">
            <h3>${title}</h3>
            ${bodyContent}
            <div class="actions">
                ${actionsContent}
            </div>
            <p class="hint">${hint}</p>
        </div>`;
    shadow.append(style, wrap);
    document.body.appendChild(host);
    const close = () => host.remove();

    if (mode === 'info') {
        const btnClose = shadow.querySelector('.cancel');
        btnClose.addEventListener('click', close);
        wrap.addEventListener('click', e => { if (e.target === wrap) close(); });
        shadow.addEventListener('keydown', e => {
            if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); close(); }
        });
        wrap.setAttribute('tabindex', '-1');
        wrap.focus();
    } else if (mode === 'secret') {
        const inp = shadow.querySelector('#sec');
        const btnSave = shadow.querySelector('.save');
        const btnCancel = shadow.querySelector('.cancel');
        const btnToggle = shadow.querySelector('#toggle');
        const btnTest = shadow.querySelector('.test');
        if (typeof initial === 'string' && initial) inp.value = initial;
        btnToggle.addEventListener('click', () => { inp.type = (inp.type === 'password') ? 'text' : 'password'; inp.focus(); });
        btnSave.addEventListener('click', async () => {
            const v = inp.value.trim();
            if (!v) return;
            await onSave?.(v);
            btnSave.textContent = 'Saved';
            btnSave.style.background = '#34a853';
            btnSave.style.borderColor = '#34a853';
            setTimeout(close, 1000);
        });
        btnCancel.addEventListener('click', close);
        btnTest?.addEventListener('click', async () => { await onValidate?.(inp.value.trim()); });
        wrap.addEventListener('click', e => { if (e.target === wrap) close(); });
        shadow.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); close(); } if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); btnSave.click(); } });
        inp.focus();
    } else if (mode === 'domain') {
        const ta = shadow.querySelector('textarea.editable');
        const btnSave = shadow.querySelector('.save');
        const btnCancel = shadow.querySelector('.cancel');
        btnSave.addEventListener('click', async () => { const lines = parseLines(ta.value); await onSave?.(lines); close(); });
        btnCancel.addEventListener('click', close);
        wrap.addEventListener('click', e => { if (e.target === wrap) close(); });
        shadow.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); close(); } if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); btnSave.click(); } });
        ta.focus();
        ta.selectionStart = ta.selectionEnd = ta.value.length;
    } else {
        const ta = shadow.querySelector('textarea');
        const btnSave = shadow.querySelector('.save');
        const btnCancel = shadow.querySelector('.cancel');
        btnSave.addEventListener('click', async () => { const lines = parseLines(ta.value); await onSave?.(lines); close(); });
        btnCancel.addEventListener('click', close);
        wrap.addEventListener('click', e => { if (e.target === wrap) close(); });
        shadow.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); close(); } if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); btnSave.click(); } });
        ta.focus();
        ta.selectionStart = ta.selectionEnd = ta.value.length;
    }
}

/**
 * Show info dialog
 */
export function openInfo(message) {
    openEditor({ title: 'Summarize The Web', mode: 'info', initial: message, hint: 'Press Enter or Escape to close.' });
}

/**
 * Show API key dialog
 */
export function openKeyDialog(storage, extra, apiKeyDialogShown) {
    if (apiKeyDialogShown.value) {
        return;
    }
    apiKeyDialogShown.value = true;

    openEditor({
        title: extra || 'OpenAI API key',
        mode: 'secret',
        initial: '',
        hint: 'Stored locally (GM → localStorage → memory). Validate sends GET /v1/models.',
        onSave: async (val) => {
            const ok = await storage.set(STORAGE_KEYS.OPENAI_KEY, val);
            apiKeyDialogShown.value = false;
        },
        onValidate: async (val) => {
            const key = val || await storage.get(STORAGE_KEYS.OPENAI_KEY, '');
            if (!key) { openInfo('No key to test'); return; }
            try {
                await xhrGet('https://api.openai.com/v1/models', { Authorization: `Bearer ${key}` });
                openInfo('Validation OK (HTTP 200)');
            } catch (e) {
                openInfo(`Validation failed: ${e.message || e}`);
            }
        }
    });
}

/**
 * Show welcome dialog (first install)
 */
export function openWelcomeDialog(storage) {
    const host = document.createElement('div');
    host.setAttribute(UI_ATTR, '');
    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `
        .wrap{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.55);
              display:flex;align-items:center;justify-content:center}
        .modal{background:#fff;max-width:580px;width:94%;border-radius:12px;
               box-shadow:0 10px 40px rgba(0,0,0,.4);padding:24px;box-sizing:border-box}
        .modal h2{margin:0 0 16px;font:700 20px/1.3 system-ui,sans-serif;color:#1a1a1a}
        .modal p{margin:0 0 12px;font:14px/1.6 system-ui,sans-serif;color:#444}
        .modal .steps{background:#f8f9fa;padding:16px;border-radius:8px;margin:16px 0;
                       font:13px/1.5 system-ui,sans-serif}
        .modal .steps ol{margin:8px 0 0;padding-left:20px}
        .modal .steps li{margin:6px 0}
        .modal .steps a{color:#667eea;text-decoration:none}
        .modal .steps a:hover{text-decoration:underline}
        .actions{display:flex;gap:12px;justify-content:flex-end;margin-top:20px}
        .btn{padding:10px 20px;border-radius:8px;border:none;font:600 14px system-ui,sans-serif;
             cursor:pointer;transition:all 0.15s ease}
        .btn.primary{background:#667eea;color:#fff}
        .btn.primary:hover{background:#5568d3}
        .btn.secondary{background:#e8eaed;color:#1a1a1a}
        .btn.secondary:hover{background:#dadce0}
    `;
    const wrap = document.createElement('div');
    wrap.className = 'wrap';

    wrap.innerHTML = `
        <div class="modal" role="dialog" aria-modal="true" aria-label="Welcome">
            <h2>Welcome to Summarize The Web!</h2>
            <p>This userscript helps you summarize and simplify web articles using AI.</p>
            <p>To get started, you'll need an OpenAI API key:</p>
            <div class="steps">
                <ol>
                    <li>Visit <a href="https://platform.openai.com/api-keys" target="_blank">OpenAI API Keys</a></li>
                    <li>Sign in or create an account</li>
                    <li>Click "Create new secret key"</li>
                    <li>Copy the key and paste it in the next dialog</li>
                </ol>
            </div>
            <p style="font-size:13px;color:#666;margin-top:16px"><strong>Domain control:</strong> By default, all websites are disabled. After setup, you can enable websites one by one via the menu.</p>
            <p style="font-size:13px;color:#666">The script uses GPT-5 Nano (cost-effective). Your key is stored locally and never shared.</p>
            <div class="actions">
                <button class="btn secondary cancel">Maybe Later</button>
                <button class="btn primary continue">Set Up API Key</button>
            </div>
        </div>`;

    shadow.append(style, wrap);
    document.body.appendChild(host);

    const btnContinue = shadow.querySelector('.continue');
    const btnCancel = shadow.querySelector('.cancel');

    btnContinue.addEventListener('click', async () => {
        host.remove();
        openEditor({
            title: 'OpenAI API key',
            mode: 'secret',
            initial: '',
            hint: 'Paste your API key here. Click Validate to test it, then Save.',
            onSave: async (val) => {
                await storage.set(STORAGE_KEYS.OPENAI_KEY, val);
                await storage.set(STORAGE_KEYS.DOMAINS_MODE, 'deny');
                await storage.set(STORAGE_KEYS.FIRST_INSTALL, 'true');
                openInfo('API key saved! The script will now work on all websites. Reload any page to see it in action.');
            },
            onValidate: async (val) => {
                const key = val || await storage.get(STORAGE_KEYS.OPENAI_KEY, '');
                if (!key) { openInfo('Please enter your API key first'); return; }
                try {
                    await xhrGet('https://api.openai.com/v1/models', { Authorization: `Bearer ${key}` });
                    openInfo('Validation OK! Click Save to continue.');
                } catch (e) {
                    openInfo(`Validation failed: ${e.message || e}`);
                }
            }
        });
    });

    btnCancel.addEventListener('click', async () => {
        host.remove();
        await storage.set(STORAGE_KEYS.FIRST_INSTALL, 'true');
        openInfo('You can set up your API key anytime via the userscript menu:\n"Set / Validate OpenAI API key"');
    });

    wrap.addEventListener('click', (e) => { if (e.target === wrap) btnCancel.click(); });
    shadow.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); btnCancel.click(); } });
    wrap.setAttribute('tabindex', '-1');
    wrap.focus();
}

/**
 * Show simplification style dialog
 */
export function openSimplificationStyleDialog(storage, currentLevel, setSimplification) {
    const host = document.createElement('div');
    host.setAttribute(UI_ATTR, '');
    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `
        .wrap{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.5);
              display:flex;align-items:center;justify-content:center}
        .modal{background:#fff;max-width:520px;width:90%;border-radius:12px;
               box-shadow:0 10px 40px rgba(0,0,0,.3);padding:24px;box-sizing:border-box}
        h3{margin:0 0 8px;font:600 18px/1.2 system-ui,sans-serif;color:#1a1a1a}
        .subtitle{margin:0 0 20px;font:13px/1.4 system-ui,sans-serif;color:#666}
        .option{padding:14px;margin:10px 0;border:2px solid #e0e0e0;border-radius:8px;
                cursor:pointer;transition:all 0.2s}
        .option:hover{border-color:#667eea;background:#f8f9ff}
        .option.selected{border-color:#667eea;background:#667eea;color:#fff}
        .option-title{font:600 15px/1.2 system-ui,sans-serif;margin-bottom:6px}
        .option-desc{font:13px/1.4 system-ui,sans-serif;opacity:0.85}
        .actions{display:flex;gap:8px;justify-content:flex-end;margin-top:20px}
        .btn{padding:10px 20px;border-radius:8px;border:none;cursor:pointer;
             font:600 14px system-ui,sans-serif}
        .btn-save{background:#667eea;color:#fff}
        .btn-save:hover{background:#5568d3}
        .btn-cancel{background:#e0e0e0;color:#333}
        .btn-cancel:hover{background:#d0d0d0}
    `;

    const descriptions = {
        'Conservative': 'Minimal rephrasing - preserves original style and structure',
        'Balanced': 'Moderate simplification - good balance of clarity and faithfulness (Recommended)',
        'Aggressive': 'Maximum simplification - more creative rephrasing for easier reading'
    };

    const wrap = document.createElement('div');
    wrap.className = 'wrap';

    const optionsHtml = SIMPLIFICATION_LEVELS.map(level => `
        <div class="option ${level === currentLevel ? 'selected' : ''}" data-level="${level}">
            <div class="option-title">${level}</div>
            <div class="option-desc">${descriptions[level]}</div>
        </div>
    `).join('');

    wrap.innerHTML = `
        <div class="modal">
            <h3>Simplification Style</h3>
            <p class="subtitle">Controls how the AI simplifies language. Large/Small buttons control the target length.</p>
            ${optionsHtml}
            <div class="actions">
                <button class="btn btn-cancel">Cancel</button>
                <button class="btn btn-save">Save & Clear Cache</button>
            </div>
        </div>
    `;
    shadow.append(style, wrap);
    document.body.appendChild(host);

    let selectedLevel = currentLevel;

    const options = shadow.querySelectorAll('.option');
    options.forEach(opt => {
        opt.addEventListener('click', () => {
            options.forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            selectedLevel = opt.dataset.level;
        });
    });

    const btnSave = shadow.querySelector('.btn-save');
    const btnCancel = shadow.querySelector('.btn-cancel');

    const close = () => host.remove();

    btnSave.addEventListener('click', async () => {
        if (!SIMPLIFICATION_LEVELS.includes(selectedLevel)) return;
        await setSimplification(selectedLevel);
        btnSave.textContent = 'Saved!';
        btnSave.style.background = '#34a853';
        setTimeout(close, 800);
    });

    btnCancel.addEventListener('click', close);
    wrap.addEventListener('click', e => { if (e.target === wrap) close(); });
    shadow.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

    wrap.setAttribute('tabindex', '-1');
    wrap.focus();
}

/**
 * Show model selection dialog
 */
export function openModelSelectionDialog(storage, currentModel, onSelect) {
    const host = document.createElement('div');
    host.setAttribute(UI_ATTR, '');
    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `
        .wrap{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.5);
              display:flex;align-items:center;justify-content:center}
        .modal{background:#fff;max-width:600px;width:90%;border-radius:12px;
               box-shadow:0 10px 40px rgba(0,0,0,.3);padding:24px;box-sizing:border-box}
        h3{margin:0 0 8px;font:600 18px/1.2 system-ui,sans-serif;color:#1a1a1a}
        .subtitle{margin:0 0 20px;font:13px/1.4 system-ui,sans-serif;color:#666}
        .option{padding:16px;margin:10px 0;border:2px solid #e0e0e0;border-radius:8px;
                cursor:pointer;transition:all 0.2s;position:relative}
        .option:hover{border-color:#667eea;background:#f8f9ff}
        .option.selected{border-color:#667eea;background:#667eea;color:#fff}
        .option-header{display:flex;justify-content:space-between;align-items:start;margin-bottom:8px}
        .option-title{font:600 16px/1.2 system-ui,sans-serif}
        .option-badge{font:600 10px/1.2 system-ui,sans-serif;padding:4px 8px;
                      border-radius:4px;background:#34a853;color:#fff;text-transform:uppercase}
        .option.selected .option-badge{background:rgba(255,255,255,0.3)}
        .option-desc{font:13px/1.5 system-ui,sans-serif;opacity:0.85;margin-bottom:8px}
        .option-pricing{font:12px/1.3 system-ui,sans-serif;opacity:0.7;font-family:ui-monospace,monospace}
        .actions{display:flex;gap:8px;justify-content:flex-end;margin-top:20px}
        .btn{padding:10px 20px;border-radius:8px;border:none;cursor:pointer;
             font:600 14px system-ui,sans-serif}
        .btn-save{background:#667eea;color:#fff}
        .btn-save:hover{background:#5568d3}
        .btn-cancel{background:#e0e0e0;color:#333}
        .btn-cancel:hover{background:#d0d0d0}
    `;

    const wrap = document.createElement('div');
    wrap.className = 'wrap';

    const optionsHtml = Object.keys(MODEL_OPTIONS).map(modelId => {
        const model = MODEL_OPTIONS[modelId];
        const isSelected = modelId === currentModel;
        const badge = model.recommended ? '<span class="option-badge">Recommended</span>' : '';
        return `
            <div class="option ${isSelected ? 'selected' : ''}" data-model="${modelId}">
                <div class="option-header">
                    <div class="option-title">${model.name}</div>
                    ${badge}
                </div>
                <div class="option-desc">${model.description}</div>
                <div class="option-pricing">$${model.inputPer1M.toFixed(2)}/1M input • $${model.outputPer1M.toFixed(2)}/1M output</div>
            </div>
        `;
    }).join('');

    wrap.innerHTML = `
        <div class="modal">
            <h3>AI Model Selection</h3>
            <p class="subtitle">Choose the OpenAI model for summarization. Higher-tier models provide better quality but cost more.</p>
            ${optionsHtml}
            <div class="actions">
                <button class="btn btn-cancel">Cancel</button>
                <button class="btn btn-save">Save & Reload</button>
            </div>
        </div>
    `;
    shadow.append(style, wrap);
    document.body.appendChild(host);

    let selectedModel = currentModel;

    const options = shadow.querySelectorAll('.option');
    options.forEach(opt => {
        opt.addEventListener('click', () => {
            options.forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            selectedModel = opt.dataset.model;
        });
    });

    const btnSave = shadow.querySelector('.btn-save');
    const btnCancel = shadow.querySelector('.btn-cancel');

    const close = () => host.remove();

    btnSave.addEventListener('click', async () => {
        if (!MODEL_OPTIONS[selectedModel]) return;
        await onSelect(selectedModel);
        btnSave.textContent = 'Saved! Reloading...';
        btnSave.style.background = '#34a853';
        setTimeout(() => location.reload(), 800);
    });

    btnCancel.addEventListener('click', close);
    wrap.addEventListener('click', e => { if (e.target === wrap) close(); });
    shadow.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

    wrap.setAttribute('tabindex', '-1');
    wrap.focus();
}

/**
 * Show custom prompts dialog
 */
export function openCustomPromptDialog(storage, currentPrompts, onSave) {
    const host = document.createElement('div');
    host.setAttribute(UI_ATTR, '');
    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `
        .wrap{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.5);
              display:flex;align-items:center;justify-content:center;overflow-y:auto}
        .modal{background:#fff;max-width:700px;width:94%;border-radius:12px;
               box-shadow:0 10px 40px rgba(0,0,0,.3);padding:24px;box-sizing:border-box;
               margin:20px;max-height:90vh;overflow-y:auto}
        h3{margin:0 0 16px;font:600 18px/1.2 system-ui,sans-serif;color:#1a1a1a}
        .section{margin:16px 0}
        .section-label{font:600 12px/1.2 system-ui,sans-serif;margin:0 0 6px;color:#555;
                       text-transform:uppercase;letter-spacing:0.5px}
        textarea{width:100%;height:100px;resize:vertical;padding:10px;box-sizing:border-box;
                 font:12px/1.4 ui-monospace,Consolas,monospace;border:2px solid #e0e0e0;
                 border-radius:8px}
        textarea:focus{outline:none;border-color:#667eea}
        .actions{display:flex;gap:8px;justify-content:flex-end;margin-top:20px;
                 position:sticky;bottom:0;background:#fff;padding-top:12px}
        .btn{padding:10px 20px;border-radius:8px;border:none;cursor:pointer;
             font:600 14px system-ui,sans-serif}
        .btn-save{background:#667eea;color:#fff}
        .btn-save:hover{background:#5568d3}
        .btn-reset{background:#ff6b6b;color:#fff}
        .btn-reset:hover{background:#ee5a52}
        .btn-cancel{background:#e0e0e0;color:#333}
        .btn-cancel:hover{background:#d0d0d0}
        .hint{margin:6px 0 0;color:#999;font:11px/1.3 system-ui,sans-serif}
    `;

    const wrap = document.createElement('div');
    wrap.className = 'wrap';
    wrap.innerHTML = `
        <div class="modal">
            <h3>Custom Summary Prompts</h3>
            <div class="section">
                <div class="section-label">Large Summary (50%)</div>
                <textarea id="summary-large-prompt">${currentPrompts.summary_large || DEFAULT_PROMPTS.summary_large}</textarea>
                <p class="hint">Summarizes content to approximately 50% of original length</p>
            </div>
            <div class="section">
                <div class="section-label">Small Summary (20%)</div>
                <textarea id="summary-small-prompt">${currentPrompts.summary_small || DEFAULT_PROMPTS.summary_small}</textarea>
                <p class="hint">Creates a concise summary at approximately 20% of original length</p>
            </div>
            <div class="actions">
                <button class="btn btn-reset">Reset to Default</button>
                <button class="btn btn-cancel">Cancel</button>
                <button class="btn btn-save">Save & Clear Cache</button>
            </div>
        </div>
    `;
    shadow.append(style, wrap);
    document.body.appendChild(host);

    const summaryLarge = shadow.querySelector('#summary-large-prompt');
    const summarySmall = shadow.querySelector('#summary-small-prompt');
    const btnSave = shadow.querySelector('.btn-save');
    const btnReset = shadow.querySelector('.btn-reset');
    const btnCancel = shadow.querySelector('.btn-cancel');

    const close = () => host.remove();

    btnSave.addEventListener('click', async () => {
        const prompts = {
            summary_large: summaryLarge.value.trim() || DEFAULT_PROMPTS.summary_large,
            summary_small: summarySmall.value.trim() || DEFAULT_PROMPTS.summary_small
        };
        await onSave(prompts);
        btnSave.textContent = 'Saved!';
        btnSave.style.background = '#34a853';
        setTimeout(close, 1000);
    });

    btnReset.addEventListener('click', async () => {
        summaryLarge.value = DEFAULT_PROMPTS.summary_large;
        summarySmall.value = DEFAULT_PROMPTS.summary_small;
        btnReset.textContent = 'Reset!';
        setTimeout(() => { btnReset.textContent = 'Reset to Default'; }, 1000);
    });

    btnCancel.addEventListener('click', close);
    wrap.addEventListener('click', e => { if (e.target === wrap) close(); });
    shadow.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

    wrap.setAttribute('tabindex', '-1');
    wrap.focus();
}

/**
 * Show usage statistics dialog
 */
export function showStats(cacheSize) {
    const host = document.createElement('div');
    host.setAttribute(UI_ATTR, '');
    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `
        .wrap{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.45);
             display:flex;align-items:center;justify-content:center}
        .modal{background:#fff;max-width:600px;width:92%;border-radius:12px;
               box-shadow:0 10px 40px rgba(0,0,0,.4);padding:20px;box-sizing:border-box;
               max-height:80vh;overflow-y:auto}
        h3{margin:0 0 16px;font:600 18px/1.2 system-ui,sans-serif;color:#1a1a1a}
        .section{background:#f8f9fa;padding:14px;border-radius:8px;margin:12px 0;
                 border-left:3px solid #667eea}
        .section h4{margin:0 0 10px;font:600 15px/1.2 system-ui,sans-serif;color:#667eea}
        .stat-row{display:flex;justify-content:space-between;padding:6px 0;
                  font:13px/1.4 system-ui,sans-serif;border-bottom:1px solid #e9ecef}
        .stat-row:last-child{border-bottom:none}
        .stat-label{color:#495057;font-weight:500}
        .stat-value{color:#212529;font-weight:600}
        .cost-highlight{background:#e8f4fd;padding:12px;border-radius:6px;margin:12px 0;
                        border-left:3px solid #667eea}
        .cost-label{font:13px/1.2 system-ui,sans-serif;color:#666;margin-bottom:4px}
        .cost-value{font:24px/1.2 system-ui,sans-serif;font-weight:700;color:#667eea}
        .actions{display:flex;gap:8px;justify-content:flex-end;margin-top:16px}
        .btn{padding:10px 20px;border-radius:8px;border:none;cursor:pointer;
             font:600 14px system-ui,sans-serif}
        .btn-close{background:#667eea;color:#fff}
        .btn-close:hover{background:#5568d3}
        .note{font:11px/1.4 system-ui,sans-serif;color:#6c757d;margin-top:12px;
              padding:8px;background:#fff3cd;border-radius:4px;border-left:3px solid #ffc107}
    `;

    const totalTokens = API_TOKENS.digest.input + API_TOKENS.digest.output;
    const totalCalls = API_TOKENS.digest.calls;
    const estimatedCost = calculateApiCost();

    const wrap = document.createElement('div');
    wrap.className = 'wrap';
    wrap.innerHTML = `
        <div class="modal">
            <h3>Usage Statistics</h3>

            <div class="cost-highlight">
                <div class="cost-label">Estimated Total Cost</div>
                <div class="cost-value">$${estimatedCost.toFixed(4)}</div>
            </div>

            <div class="section">
                <h4>API Usage (All Time)</h4>
                <div class="stat-row">
                    <span class="stat-label">Total API Calls</span>
                    <span class="stat-value">${totalCalls.toLocaleString()}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Total Tokens</span>
                    <span class="stat-value">${totalTokens.toLocaleString()}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Input Tokens</span>
                    <span class="stat-value">${API_TOKENS.digest.input.toLocaleString()}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Output Tokens</span>
                    <span class="stat-value">${API_TOKENS.digest.output.toLocaleString()}</span>
                </div>
            </div>

            <div class="section">
                <h4>Cache Statistics</h4>
                <div class="stat-row">
                    <span class="stat-label">Cached Digests</span>
                    <span class="stat-value">${cacheSize} entries</span>
                </div>
            </div>

            <div class="section">
                <h4>Current Model Configuration</h4>
                <div class="stat-row">
                    <span class="stat-label">Model</span>
                    <span class="stat-value">${MODEL_OPTIONS[PRICING.model]?.name || PRICING.model}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Input Cost</span>
                    <span class="stat-value">$${PRICING.inputPer1M.toFixed(2)} / 1M tokens</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Output Cost</span>
                    <span class="stat-value">$${PRICING.outputPer1M.toFixed(2)} / 1M tokens</span>
                </div>
            </div>

            <div class="note">
                Usage stats persist across page loads. Use "Reset API usage stats" from the menu to clear counters.
            </div>

            <div class="actions">
                <button class="btn btn-close">Close</button>
            </div>
        </div>
    `;
    shadow.append(style, wrap);
    document.body.appendChild(host);

    const close = () => host.remove();
    const btnClose = shadow.querySelector('.btn-close');
    btnClose.addEventListener('click', close);
    wrap.addEventListener('click', e => { if (e.target === wrap) close(); });
    shadow.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); close(); } });

    wrap.setAttribute('tabindex', '-1');
    wrap.focus();
}

/**
 * Show domain list editor dialog
 */
export function openDomainEditor(storage, mode, DOMAIN_ALLOW, DOMAIN_DENY) {
    const host = document.createElement('div');
    host.setAttribute(UI_ATTR, '');
    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `
        .wrap{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.5);
              display:flex;align-items:center;justify-content:center}
        .modal{background:#fff;max-width:600px;width:90%;border-radius:12px;
               box-shadow:0 10px 40px rgba(0,0,0,.3);padding:20px;box-sizing:border-box}
        h3{margin:0 0 12px;font:600 18px/1.2 system-ui,sans-serif}
        textarea{width:100%;height:240px;resize:vertical;padding:12px;box-sizing:border-box;
                 font:13px/1.4 ui-monospace,Consolas,monospace;border:2px solid #e0e0e0;
                 border-radius:8px}
        textarea:focus{outline:none;border-color:#667eea}
        .hint{margin:12px 0;color:#666;font:12px/1.4 system-ui,sans-serif}
        .actions{display:flex;gap:8px;justify-content:flex-end}
        .btn{padding:10px 20px;border-radius:8px;border:none;cursor:pointer;
             font:600 14px system-ui,sans-serif}
        .btn-save{background:#667eea;color:#fff}
        .btn-save:hover{background:#5568d3}
        .btn-cancel{background:#e0e0e0;color:#333}
        .btn-cancel:hover{background:#d0d0d0}
    `;

    const list = mode === 'allow' ? DOMAIN_ALLOW : DOMAIN_DENY;
    const title = mode === 'allow' ? 'Allowlist (Enabled Domains)' : 'Denylist (Disabled Domains)';
    const hint = mode === 'allow'
        ? 'In ALLOW mode, the script only runs on these domains. One pattern per line. Supports wildcards (*.example.com) and regex (/pattern/).'
        : 'In DENY mode, the script is disabled on these domains. One pattern per line. Supports wildcards (*.example.com) and regex (/pattern/).';

    const wrap = document.createElement('div');
    wrap.className = 'wrap';
    wrap.innerHTML = `
        <div class="modal">
            <h3>${title}</h3>
            <textarea>${list.join('\n')}</textarea>
            <p class="hint">${hint}</p>
            <div class="actions">
                <button class="btn btn-cancel">Cancel</button>
                <button class="btn btn-save">Save & Reload</button>
            </div>
        </div>
    `;
    shadow.append(style, wrap);
    document.body.appendChild(host);

    const textarea = shadow.querySelector('textarea');
    const btnSave = shadow.querySelector('.btn-save');
    const btnCancel = shadow.querySelector('.btn-cancel');

    const close = () => host.remove();

    btnSave.addEventListener('click', async () => {
        const lines = textarea.value.split('\n').map(l => l.trim()).filter(Boolean);
        if (mode === 'allow') {
            await storage.set(STORAGE_KEYS.DOMAINS_ALLOW, JSON.stringify(lines));
        } else {
            await storage.set(STORAGE_KEYS.DOMAINS_DENY, JSON.stringify(lines));
        }
        location.reload();
    });

    btnCancel.addEventListener('click', close);
    wrap.addEventListener('click', e => { if (e.target === wrap) close(); });
    shadow.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

    wrap.setAttribute('tabindex', '-1');
    wrap.focus();
}

/**
 * Show unified selector editor dialog (global + domain-specific, tabbed)
 */
export function openSelectorEditor({ host, selectorsGlobal, excludeGlobal, selectorsDomain, excludeDomain, defaultSelectors, defaultExcludes, onSave }) {
    const hostEl = document.createElement('div');
    hostEl.setAttribute(UI_ATTR, '');
    const shadow = hostEl.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `
        .wrap{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.4);
              display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:40px 0}
        .modal{background:linear-gradient(135deg,#f8f9ff 0%,#fff5f7 100%);max-width:700px;width:96%;
               border-radius:16px;box-shadow:0 10px 40px rgba(102,126,234,0.35);
               display:flex;flex-direction:column;box-sizing:border-box;overflow:hidden;
               border:3px solid #667eea;max-height:calc(100vh - 80px)}
        .header{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:16px 20px;
                display:flex;align-items:center;justify-content:space-between}
        .header-title{font:600 16px/1.2 system-ui,sans-serif;color:#fff}
        .header-close{background:rgba(255,255,255,0.2);border:1px solid rgba(255,255,255,0.3);
                      color:#fff;font-size:20px;font-weight:600;width:32px;height:32px;
                      border-radius:8px;cursor:pointer;display:flex;align-items:center;
                      justify-content:center;transition:all 0.2s;padding:0;line-height:1}
        .header-close:hover{background:rgba(255,255,255,0.3);transform:scale(1.05)}
        .content{padding:20px;overflow-y:auto;flex:1}
        .tabs{display:inline-flex;margin:0 0 16px;background:rgba(102,126,234,0.15);border-radius:8px;padding:4px}
        .tab{padding:8px 16px;border:none;background:none;cursor:pointer;
             font:600 13px/1.2 system-ui,sans-serif;color:#667eea;border-radius:6px;
             transition:all 0.15s;white-space:nowrap}
        .tab:hover{background:rgba(255,255,255,0.5)}
        .tab.active{background:#fff;color:#667eea;box-shadow:0 2px 8px rgba(102,126,234,0.25)}
        .tab-panel{display:none}
        .tab-panel.active{display:block}
        .section{margin:0 0 16px;padding:12px;background:rgba(255,255,255,0.8);border-radius:8px;
                 border:1px solid rgba(102,126,234,0.15)}
        .section:last-child{margin-bottom:0}
        .section-label{font:600 13px system-ui,sans-serif;margin:0 0 8px;color:#667eea;
                       text-transform:uppercase;letter-spacing:0.5px}
        .section-hint{font:11px/1.3 system-ui,sans-serif;color:#888;margin:4px 0 0}
        textarea{width:100%;height:100px;resize:vertical;padding:10px;box-sizing:border-box;
                 font:12px/1.4 ui-monospace,Consolas,monospace;border:1px solid rgba(102,126,234,0.2);
                 border-radius:6px;background:#fff}
        textarea:focus{outline:none;border-color:#667eea;box-shadow:0 0 0 3px rgba(102,126,234,0.1)}
        textarea.readonly{background:#f0f0f5;color:#666;height:70px;cursor:default}
        textarea.editable{height:80px}
        .context-label{font:500 10px/1.2 system-ui,sans-serif;color:#888;margin:10px 0 4px;
                       text-transform:uppercase;letter-spacing:0.3px}
        .footer{padding:16px 20px;background:rgba(102,126,234,0.05);
                border-top:1px solid rgba(102,126,234,0.15);display:flex;gap:8px;justify-content:flex-end}
        .btn{padding:10px 16px;border-radius:8px;border:none;cursor:pointer;
             font:600 13px system-ui,sans-serif;transition:all 0.15s ease}
        .btn-save{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;
                  box-shadow:0 4px 12px rgba(102,126,234,0.3)}
        .btn-save:hover{transform:translateY(-2px);box-shadow:0 6px 16px rgba(102,126,234,0.4)}
        .btn-reset{background:#ea4335;color:#fff}
        .btn-reset:hover{background:#d33426}
        .btn-cancel{background:#e8eaed;color:#1a1a1a}
        .btn-cancel:hover{background:#dadce0}
    `;

    const globalSelectors = (selectorsGlobal || []).join('\n');
    const globalExSelf = (excludeGlobal.self || []).join('\n');
    const globalExAnc = (excludeGlobal.ancestors || []).join('\n');
    const domSelectors = (selectorsDomain || []).join('\n');
    const domExSelf = (excludeDomain.self || []).join('\n');
    const domExAnc = (excludeDomain.ancestors || []).join('\n');

    const wrap = document.createElement('div');
    wrap.className = 'wrap';
    wrap.innerHTML = `
        <div class="modal" role="dialog" aria-modal="true" aria-label="Edit Selectors">
            <div class="header">
                <span class="header-title">Edit Selectors</span>
                <button class="header-close" aria-label="Close">\u00d7</button>
            </div>
            <div class="content">
                <div class="tabs">
                    <button class="tab active" data-tab="global">Global</button>
                    <button class="tab" data-tab="domain">${escapeHtml(host)}</button>
                </div>

                <div class="tab-panel active" data-panel="global">
                    <div class="section">
                        <div class="section-label">Container Selectors</div>
                        <textarea id="g-selectors" spellcheck="false">${escapeHtml(globalSelectors)}</textarea>
                        <div class="section-hint">CSS selectors for finding article containers. One per line.</div>
                    </div>
                    <div class="section">
                        <div class="section-label">Excluded Elements (self)</div>
                        <textarea id="g-ex-self" spellcheck="false">${escapeHtml(globalExSelf)}</textarea>
                        <div class="section-hint">Elements matching these selectors are skipped. One per line.</div>
                    </div>
                    <div class="section">
                        <div class="section-label">Excluded Containers (ancestors)</div>
                        <textarea id="g-ex-anc" spellcheck="false">${escapeHtml(globalExAnc)}</textarea>
                        <div class="section-hint">Text inside these containers is excluded. One per line.</div>
                    </div>
                </div>

                <div class="tab-panel" data-panel="domain">
                    <div class="section">
                        <div class="section-label">Container Selectors</div>
                        <div class="context-label">Global (read-only)</div>
                        <textarea class="readonly" readonly spellcheck="false">${escapeHtml(globalSelectors)}</textarea>
                        <div class="context-label">Domain-specific additions</div>
                        <textarea id="d-selectors" class="editable" spellcheck="false">${escapeHtml(domSelectors)}</textarea>
                    </div>
                    <div class="section">
                        <div class="section-label">Excluded Elements (self)</div>
                        <div class="context-label">Global (read-only)</div>
                        <textarea class="readonly" readonly spellcheck="false">${escapeHtml(globalExSelf)}</textarea>
                        <div class="context-label">Domain-specific additions</div>
                        <textarea id="d-ex-self" class="editable" spellcheck="false">${escapeHtml(domExSelf)}</textarea>
                    </div>
                    <div class="section">
                        <div class="section-label">Excluded Containers (ancestors)</div>
                        <div class="context-label">Global (read-only)</div>
                        <textarea class="readonly" readonly spellcheck="false">${escapeHtml(globalExAnc)}</textarea>
                        <div class="context-label">Domain-specific additions</div>
                        <textarea id="d-ex-anc" class="editable" spellcheck="false">${escapeHtml(domExAnc)}</textarea>
                    </div>
                </div>
            </div>
            <div class="footer">
                <button class="btn btn-reset">Reset Defaults</button>
                <button class="btn btn-cancel">Cancel</button>
                <button class="btn btn-save">Save &amp; Reload</button>
            </div>
        </div>
    `;
    shadow.append(style, wrap);
    document.body.appendChild(hostEl);

    let activeTab = 'global';

    // Tab switching
    const tabs = shadow.querySelectorAll('.tab');
    const panels = shadow.querySelectorAll('.tab-panel');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            activeTab = tab.dataset.tab;
            tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === activeTab));
            panels.forEach(p => p.classList.toggle('active', p.dataset.panel === activeTab));
        });
    });

    const close = () => hostEl.remove();

    const toLines = (val) => val.split('\n').map(l => l.trim()).filter(Boolean);

    const btnSave = shadow.querySelector('.btn-save');
    const btnReset = shadow.querySelector('.btn-reset');
    const btnCancel = shadow.querySelector('.btn-cancel');

    btnSave.addEventListener('click', async () => {
        const data = {
            global: {
                selectors: toLines(shadow.querySelector('#g-selectors').value),
                excludeSelf: toLines(shadow.querySelector('#g-ex-self').value),
                excludeAncestors: toLines(shadow.querySelector('#g-ex-anc').value)
            },
            domain: {
                selectors: toLines(shadow.querySelector('#d-selectors').value),
                excludeSelf: toLines(shadow.querySelector('#d-ex-self').value),
                excludeAncestors: toLines(shadow.querySelector('#d-ex-anc').value)
            }
        };
        await onSave(data);
        btnSave.textContent = '\u2713 Saved!';
        setTimeout(() => location.reload(), 800);
    });

    btnReset.addEventListener('click', () => {
        if (activeTab === 'global') {
            shadow.querySelector('#g-selectors').value = (defaultSelectors || []).join('\n');
            shadow.querySelector('#g-ex-self').value = (defaultExcludes.self || []).join('\n');
            shadow.querySelector('#g-ex-anc').value = (defaultExcludes.ancestors || []).join('\n');
        } else {
            shadow.querySelector('#d-selectors').value = '';
            shadow.querySelector('#d-ex-self').value = '';
            shadow.querySelector('#d-ex-anc').value = '';
        }
        btnReset.textContent = 'Reset!';
        setTimeout(() => { btnReset.textContent = 'Reset Defaults'; }, 1000);
    });

    btnCancel.addEventListener('click', close);
    shadow.querySelector('.header-close').addEventListener('click', close);
    wrap.addEventListener('click', e => { if (e.target === wrap) close(); });
    shadow.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

    wrap.setAttribute('tabindex', '-1');
    wrap.focus();
}
