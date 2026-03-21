// ==UserScript==
// @name         [Neon] itzagud Tagger
// @description Tag resellers, trusted bidders etc. on itzagud auctions.
// @author      Neon Crypt
// @iconURL     https://www.itzagud.net/apple-touch-icon.png
// @match       *://www.itzagud.net/auctions*
// @grant       none
// @run-at      document-end
// @version     1.0
// ==/UserScript==

(function () {
    'use strict';

    const LS_TAGS   = 'rtagger_tags_v13';
    const LS_POS    = 'rtagger_pos_v13';
    const LS_HIDDEN = 'rtagger_hidden_v13';

    let tags = [];
    try { tags = JSON.parse(localStorage.getItem(LS_TAGS) || '[]'); } catch (e) {}

    let tagMap = new Map();
    function rebuildMap() {
        tagMap = new Map(tags.map(t => [t.name.toLowerCase(), t]));
    }
    rebuildMap();

    function saveTags() {
        try { localStorage.setItem(LS_TAGS, JSON.stringify(tags)); } catch (e) {}
        rebuildMap();
    }

    function esc(s) {
        return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Styles — copied verbatim from Stats widget, with tagger additions appended
    // ─────────────────────────────────────────────────────────────────────────
    function iS() {
        if (document.getElementById('rtagger-styles')) return;
        const style = document.createElement('style');
        style.id = 'rtagger-styles';
        style.textContent = `
            @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&display=swap');

            :root {
                --itz-bg: rgba(9,9,11,0.88);
                --itz-border: rgba(63,63,70,0.4);
                --itz-glass: blur(12px);
                --itz-accent: #a78bfa;
                --itz-font: 'Rajdhani', sans-serif;
            }

            #rtagger-widget {
                position: fixed;
                top: 50%;
                right: 16px;
                transform: translateY(-50%);
                z-index: 10001;
                width: 260px;
                font-family: var(--itz-font);
                background: var(--itz-bg);
                backdrop-filter: var(--itz-glass);
                -webkit-backdrop-filter: var(--itz-glass);
                border: 1px solid var(--itz-border);
                border-radius: 14px;
                padding: 12px 14px 14px;
                box-shadow: 0 8px 24px rgba(0,0,0,0.55), 0 0 16px rgba(167,139,250,0.08);
                color: #f4f4f5;
                transition: all 0.3s cubic-bezier(0.4,0,0.2,1);
            }
            #rtagger-widget.itz-hidden {
                background: transparent !important;
                backdrop-filter: none !important;
                -webkit-backdrop-filter: none !important;
                border-color: transparent !important;
                box-shadow: none !important;
            }
            #rtagger-widget.itz-hidden #rtagger-content,
            #rtagger-widget.itz-hidden .itz-title-label,
            #rtagger-widget.itz-hidden .itz-title-icon { display: none; }

            #rtagger-widget .itz-title-row {
                display: flex; align-items: center; gap: 6px;
                margin-bottom: 10px;
                border-bottom: 1px solid var(--itz-border);
                padding-bottom: 8px;
                cursor: grab; user-select: none;
            }
            #rtagger-widget .itz-title-row:active { cursor: grabbing; }

            #rtagger-widget #itz-toggle-btn {
                margin-left: auto;
                background: rgba(167,139,250,0.1);
                border: 1px solid rgba(167,139,250,0.28);
                color: var(--itz-accent);
                border-radius: 6px;
                padding: 2px 7px;
                font-family: var(--itz-font);
                font-size: 11px; font-weight: 700;
                cursor: pointer; line-height: 1.5;
                user-select: none;
                transition: background 0.2s;
            }
            #rtagger-widget #itz-toggle-btn:hover { background: rgba(167,139,250,0.24); }

            #rtagger-widget .itz-section { margin-bottom: 10px; }
            #rtagger-widget .itz-section:last-child { margin-bottom: 0; }

            /* ── form fields, matching stats widget input aesthetic ── */
            #rtagger-widget .rt-input {
                width: 100%; margin-top: 5px; padding: 6px 8px;
                border-radius: 6px; border: 1px solid #27272a;
                background: rgba(24,24,27,0.85); color: #f4f4f5;
                font-family: var(--itz-font); font-size: 12px; font-weight: 600;
                outline: none; box-sizing: border-box;
                transition: border-color 0.2s;
            }
            #rtagger-widget .rt-input:focus { border-color: rgba(167,139,250,0.55); }
            #rtagger-widget select.rt-input { appearance: auto; cursor: pointer; }
            #rtagger-widget select.rt-input option { background: #18181b; color: #f4f4f5; }

            #rtagger-widget .rt-row { display: flex; gap: 6px; margin-top: 5px; }
            #rtagger-widget .rt-row .rt-input { margin-top: 0; flex: 1; }

            #rtagger-widget .rt-color-wrap {
                flex-shrink: 0; width: 36px; height: 30px;
                border-radius: 6px; border: 1px solid #27272a;
                background: rgba(24,24,27,0.85);
                overflow: hidden; cursor: pointer;
                display: flex; align-items: center; justify-content: center;
                transition: border-color 0.2s;
            }
            #rtagger-widget .rt-color-wrap:hover { border-color: rgba(167,139,250,0.5); }
            #rtagger-widget .rt-color-wrap input[type="color"] {
                width: 200%; height: 200%; border: none; padding: 0;
                cursor: pointer; background: none; transform: translate(-25%,-25%);
            }

            /* ── buttons ── */
            #rtagger-widget .rt-btn {
                display: block; width: 100%; margin-top: 6px; padding: 6px 8px;
                border-radius: 6px; border: 1px solid #27272a;
                background: rgba(39,39,42,0.85); color: #f4f4f5;
                font-family: var(--itz-font); font-size: 12px; font-weight: 700;
                cursor: pointer; text-align: center; box-sizing: border-box;
                transition: background 0.2s, border-color 0.2s;
            }
            #rtagger-widget .rt-btn:hover { background: rgba(63,63,70,0.9); border-color: rgba(167,139,250,0.3); }
            #rtagger-widget .rt-btn.rt-accent {
                background: rgba(167,139,250,0.15);
                border-color: rgba(167,139,250,0.38);
                color: var(--itz-accent);
            }
            #rtagger-widget .rt-btn.rt-accent:hover { background: rgba(167,139,250,0.28); }

            #rtagger-widget .rt-io-row { display: flex; gap: 6px; }
            #rtagger-widget .rt-io-row .rt-btn { margin-top: 0; flex: 1; }

            /* ── tag list ── */
            #rtagger-widget .rt-list {
                max-height: 120px; overflow-y: auto;
                display: flex; flex-direction: column; gap: 4px;
                margin-top: 6px;
                scrollbar-width: thin;
                scrollbar-color: rgba(167,139,250,0.3) transparent;
            }
            #rtagger-widget .rt-empty {
                font-size: 12px; color: #52525b; text-align: center; padding: 6px 0;
            }
            #rtagger-widget .rt-item {
                display: flex; align-items: center; gap: 5px;
                background: rgba(39,39,42,0.5);
                border: 1px solid var(--itz-border);
                border-radius: 8px; padding: 5px 8px;
                font-size: 12px; font-weight: 600;
            }
            #rtagger-widget .rt-dot {
                width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
            }
            #rtagger-widget .rt-item-name {
                flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #f4f4f5;
            }
            #rtagger-widget .rt-item-sub { color: #71717a; font-size: 11px; flex-shrink: 0; }
            #rtagger-widget .rt-item-del {
                background: none; border: none; color: #52525b;
                cursor: pointer; font-size: 13px; padding: 0; line-height: 1;
                transition: color 0.15s; font-family: inherit; margin-left: auto;
            }
            #rtagger-widget .rt-item-del:hover { color: #f87171; }

            /* ── info strip ── */
            #rtagger-widget .rt-info {
                display: flex; justify-content: space-between; align-items: center;
                font-size: 11px; color: #52525b; padding: 2px 0;
            }
            #rtagger-widget .rt-info span:last-child { color: var(--itz-accent); font-weight: 700; }

            /* ── the badge injected next to usernames ──
               all:initial makes it immune to any page styles that caused
               the gray text issue before                                  */
            .rtagger-badge {
                all: initial;
                display: inline-flex !important;
                align-items: center !important;
                margin-left: 5px !important;
                padding: 1px 6px !important;
                border-radius: 5px !important;
                font-size: 11px !important;
                font-weight: 700 !important;
                font-family: 'Rajdhani', sans-serif !important;
                color: #fff !important;
                vertical-align: middle !important;
                line-height: 1.5 !important;
                pointer-events: none !important;
                white-space: nowrap !important;
                cursor: default !important;
                -webkit-font-smoothing: antialiased !important;
            }
        `;
        document.head.appendChild(style);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Drag — free movement anywhere on screen
    //
    // The widget in testing phase had a bug: they keep
    // `transform: translateY(-50%)` as the default position and then switch to
    // top/left only once a saved position exists. When you start dragging from
    // the default position, the transform is still active and fights the
    // pointer math, locking movement to one axis.
    //
    // Fix: on pointerdown we immediately snapshot the real getBoundingClientRect
    // position, clear the transform, and switch fully to top/left. From that
    // point the math is just pointer - offset, and movement is free in 2D.
    // ─────────────────────────────────────────────────────────────────────────
    function mkDrag(titleEl, widgetEl) {
        let dragging = false, ox = 0, oy = 0;

        // restore saved position if we have one
        try {
            const saved = JSON.parse(localStorage.getItem(LS_POS) || 'null');
            if (saved && typeof saved.x === 'number') {
                Object.assign(widgetEl.style, {
                    transition: 'none',
                    transform: 'none',
                    left: Math.max(0, Math.min(saved.x, window.innerWidth  - 260)) + 'px',
                    top:  Math.max(0, Math.min(saved.y, window.innerHeight - 50))  + 'px',
                    right: 'auto'
                });
            }
        } catch (e) {}

        titleEl.addEventListener('pointerdown', e => {
            if (e.button !== 0) return;
            if (e.target.closest?.('#itz-toggle-btn')) return;
            dragging = true;

            // snapshot rect NOW — this works whether we're in transform mode or top/left mode
            const r = widgetEl.getBoundingClientRect();
            ox = e.clientX - r.left;
            oy = e.clientY - r.top;

            // switch to top/left immediately so drag math is always clean
            Object.assign(widgetEl.style, {
                transition: 'none',
                transform: 'none',
                left: r.left + 'px',
                top:  r.top  + 'px',
                right: 'auto'
            });

            titleEl.setPointerCapture(e.pointerId);
        });

        titleEl.addEventListener('pointermove', e => {
            if (!dragging) return;
            const x = Math.max(0, Math.min(e.clientX - ox, window.innerWidth  - widgetEl.offsetWidth));
            const y = Math.max(0, Math.min(e.clientY - oy, window.innerHeight - widgetEl.offsetHeight));
            widgetEl.style.left = x + 'px';
            widgetEl.style.top  = y + 'px';
        });

        titleEl.addEventListener('pointerup', () => {
            if (!dragging) return;
            dragging = false;
            widgetEl.style.transition = '';
            const r = widgetEl.getBoundingClientRect();
            try { localStorage.setItem(LS_POS, JSON.stringify({ x: r.left, y: r.top })); } catch (e) {}
        });

        titleEl.addEventListener('pointercancel', () => { dragging = false; });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Tag engine
    // TreeWalker visits only text nodes — far cheaper than querySelectorAll('*').
    // Nodes longer than 60 chars are skipped instantly (usernames are short).
    // Parent elements are marked so re-scans cost almost nothing.
    // Badge inserted as next sibling of the text node, never inside the parent,
    // so nothing about the parent element's layout or styling is touched.
    // ─────────────────────────────────────────────────────────────────────────
    const DONE = 'data-rt-done';

    function scanRoot(root) {
        if (!root || !root.querySelectorAll || !tagMap.size) return;

        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode(node) {
                const p = node.parentElement;
                if (!p) return NodeFilter.FILTER_REJECT;
                if (p.closest('#rtagger-widget')) return NodeFilter.FILTER_REJECT;
                if (p.closest('[' + DONE + ']')) return NodeFilter.FILTER_REJECT;
                const t = p.tagName;
                if (t === 'SCRIPT' || t === 'STYLE' || t === 'NOSCRIPT') return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
            }
        });

        const hits = [];
        let node;
        while ((node = walker.nextNode())) {
            const text = node.textContent.trim();
            if (!text || text.length > 60) continue;
            const match = tagMap.get(text.toLowerCase());
            if (match) hits.push({ node, match });
        }

        for (const { node, match } of hits) {
            const parent = node.parentElement;
            if (!parent || parent.hasAttribute(DONE)) continue;
            parent.setAttribute(DONE, '1');
            const badge = document.createElement('span');
            badge.className = 'rtagger-badge';
            badge.style.cssText = 'background:' + match.color + ' !important;';
            badge.textContent = match.emoji + ' ' + match.label;
            try { node.after(badge); } catch (e) { parent.appendChild(badge); }
        }
    }

    function reApplyAll() {
        document.querySelectorAll('.rtagger-badge').forEach(el => el.remove());
        document.querySelectorAll('[' + DONE + ']').forEach(el => el.removeAttribute(DONE));
        if (tagMap.size) scanRoot(document.body);
    }

    // batched rAF observer — never re-scans the full doc, only added subtrees
    const pending = new Set();
    let rafId = null;
    const observer = new MutationObserver(mutations => {
        let any = false;
        for (const m of mutations) {
            for (const n of m.addedNodes) {
                if (n.nodeType !== 1) continue;
                if (n.id === 'rtagger-widget' || n.closest?.('#rtagger-widget')) continue;
                pending.add(n);
                any = true;
            }
        }
        if (any && rafId === null) rafId = requestAnimationFrame(() => {
            rafId = null;
            for (const n of pending) scanRoot(n);
            pending.clear();
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Widget — HTML structure mirrors the Stats widget exactly
    // ─────────────────────────────────────────────────────────────────────────
    function wg() {
        if (document.getElementById('rtagger-widget')) return;
        iS();

        const widget = document.createElement('div');
        widget.id = 'rtagger-widget';

        let isHidden = false;
        try { isHidden = localStorage.getItem(LS_HIDDEN) === '1'; } catch (e) {}
        if (isHidden) widget.classList.add('itz-hidden');

        // title row
        const titleRow = document.createElement('div');
        titleRow.className = 'itz-title-row';

        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'itz-toggle-btn';
        toggleBtn.textContent = isHidden ? '👁 Show' : '👁 Hide';
        toggleBtn.addEventListener('click', e => {
            e.stopPropagation();
            const h = widget.classList.toggle('itz-hidden');
            toggleBtn.textContent = h ? '👁 Show' : '👁 Hide';
            try { localStorage.setItem(LS_HIDDEN, h ? '1' : '0'); } catch (e) {}
        });

        titleRow.innerHTML = `<span class="itz-title-icon" style="font-size:15px;line-height:1;">🏷</span><span class="itz-title-label" style="font-weight:700;font-size:14px;letter-spacing:0.5px;color:var(--itz-accent);">ITZAGUD TAGGER</span>`;
        titleRow.appendChild(toggleBtn);
        mkDrag(titleRow, widget);
        widget.appendChild(titleRow);

        // content
        const content = document.createElement('div');
        content.id = 'rtagger-content';
        content.innerHTML = `
            <div class="itz-section">
                <input id="rt-name"  class="rt-input" placeholder="Exact username" autocomplete="off" spellcheck="false">
                <input id="rt-label" class="rt-input" placeholder="Tag label (e.g. Reseller)" autocomplete="off">
                <div class="rt-row">
                    <select id="rt-emoji" class="rt-input">
                        <option>⚠️</option>
                        <option>💰</option>
                        <option>🔥</option>
                        <option>👑</option>
                        <option>💀</option>
                        <option>✅</option>
                        <option>🛡️</option>
                        <option>⭐</option>
                        <option>🚩</option>
                        <option>🤝</option>
                        <option>🤡</option>
                        <option>😈</option>
                    </select>
                    <div class="rt-color-wrap" title="Badge color">
                        <input id="rt-color" type="color" value="#a78bfa">
                    </div>
                </div>
                <button id="rt-add" class="rt-btn rt-accent" style="margin-top:7px;">＋ Add Tag</button>
            </div>

            <div class="itz-section">
                <div class="rt-list" id="rt-list"></div>
                <div class="rt-info" style="margin-top:6px;">
                    <span>Tagged users</span>
                    <span id="rt-count">0</span>
                </div>
            </div>

            <div class="itz-section">
                <div class="rt-io-row">
                    <button id="rt-export" class="rt-btn">⬆ Export</button>
                    <button id="rt-import" class="rt-btn">⬇ Import</button>
                </div>
            </div>
        `;
        widget.appendChild(content);
        document.body.appendChild(widget);

        function updateCount() {
            const el = document.getElementById('rt-count');
            if (el) el.textContent = tags.length;
        }

        function renderList() {
            const list = document.getElementById('rt-list');
            if (!list) return;
            list.innerHTML = '';
            if (!tags.length) {
                list.innerHTML = '<div class="rt-empty">no tags yet</div>';
                updateCount();
                return;
            }
            tags.forEach((t, i) => {
                const item = document.createElement('div');
                item.className = 'rt-item';
                item.innerHTML = `
                    <span class="rt-dot" style="background:${t.color};box-shadow:0 0 5px ${t.color}66;"></span>
                    <span class="rt-item-name">${t.emoji} ${esc(t.name)}</span>
                    <span class="rt-item-sub">${esc(t.label)}</span>
                    <button class="rt-item-del" title="Remove">✕</button>
                `;
                item.querySelector('.rt-item-del').addEventListener('click', () => {
                    tags.splice(i, 1);
                    saveTags();
                    renderList();
                    reApplyAll();
                });
                list.appendChild(item);
            });
            updateCount();
        }

        document.getElementById('rt-add').addEventListener('click', () => {
            const nEl = document.getElementById('rt-name');
            const lEl = document.getElementById('rt-label');
            const name  = nEl.value.trim();
            const label = lEl.value.trim();
            nEl.style.borderColor = name  ? '' : '#f87171';
            lEl.style.borderColor = label ? '' : '#f87171';
            if (!name || !label) return;
            nEl.style.borderColor = '';
            lEl.style.borderColor = '';

            const emoji = document.getElementById('rt-emoji').value;
            const color = document.getElementById('rt-color').value;
            const idx = tags.findIndex(t => t.name.toLowerCase() === name.toLowerCase());
            if (idx !== -1) tags.splice(idx, 1);
            tags.push({ name, label, emoji, color });

            saveTags();
            nEl.value = '';
            lEl.value = '';
            renderList();
            reApplyAll();
        });

        ['rt-name', 'rt-label'].forEach(id => {
            document.getElementById(id).addEventListener('keydown', e => {
                if (e.key === 'Enter') document.getElementById('rt-add').click();
            });
        });

        document.getElementById('rt-export').addEventListener('click', () => {
            const btn  = document.getElementById('rt-export');
            const json = JSON.stringify(tags, null, 2);
            const flash = txt => { const o = btn.textContent; btn.textContent = txt; setTimeout(() => btn.textContent = o, 1600); };
            if (navigator.clipboard?.writeText) {
                navigator.clipboard.writeText(json).then(() => flash('✅ Copied!')).catch(() => prompt('Copy:', json));
            } else { prompt('Copy:', json); }
        });

        document.getElementById('rt-import').addEventListener('click', () => {
            const raw = prompt('Paste your tags JSON:');
            if (!raw) return;
            try {
                const parsed = JSON.parse(raw);
                if (!Array.isArray(parsed)) throw 0;
                parsed.forEach(t => { if (!t.name || !t.label) throw 0; });
                tags = parsed;
                saveTags();
                renderList();
                reApplyAll();
            } catch (e) { alert("Couldn't import — invalid JSON."); }
        });

        renderList();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Boot — 400ms delay so React finishes hydrating before we walk the DOM
    // ─────────────────────────────────────────────────────────────────────────
    function bt() {
        wg();
        requestAnimationFrame(() => {
            scanRoot(document.body);
            observer.observe(document.body, { childList: true, subtree: true });
        });
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(bt, 400);
    } else {
        document.addEventListener('DOMContentLoaded', () => setTimeout(bt, 400));
    }

})();
