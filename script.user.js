// ==UserScript==
// @name         itzagud Tagger
// @namespace    https://github.com/Neon-Crypt/itzagud-Tagger
// @description  Tag resellers, trusted bidders etc. on itzagud auctions.
// @author       Neon Crypt
// @version      1.1
// @license      CC BY 4.0
// @iconURL      https://www.itzagud.net/apple-touch-icon.png
// @match        *://www.itzagud.net/*
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/Neon-Crypt/itzagud-Tagger/main/script.user.js
// @downloadURL  https://raw.githubusercontent.com/Neon-Crypt/itzagud-Tagger/main/script.user.js
// @noframes
// ==/UserScript==

(function () {
    'use strict';

    // ── storage ───────────────────────────────────────────────────────────────
    const K_TAGS   = 'rtagger_tags_v13';   // keep same key so existing tags carry over
    const K_POS    = 'rtagger_pos_v11';
    const K_HIDDEN = 'rtagger_hidden_v11';
    const K_FS     = 'rtagger_fs_v11';

    const gv = (k, d) => { try { return GM_getValue(k, d); } catch (_) { return d; } };
    const sv = (k, v) => { try { GM_setValue(k, v); }       catch (_) {} };

    // migrate old localStorage tags once, then use GM storage
    (function migrate() {
        try {
            if (gv(K_TAGS, null) !== null) return; // already migrated
            const old = localStorage.getItem('rtagger_tags_v13');
            if (old) sv(K_TAGS, old);
        } catch (_) {}
    })();

    // ── state ─────────────────────────────────────────────────────────────────
    let tags = [], tagMap = new Map();
    let ui_fs = 12, ui_hidden = false;

    try { tags = JSON.parse(gv(K_TAGS, '[]')); } catch (_) {}
    ui_fs     = parseInt(gv(K_FS,     '12'), 10) || 12;
    ui_hidden = gv(K_HIDDEN, '0') === '1';

    function rebuildMap() { tagMap = new Map(tags.map(t => [t.name.toLowerCase(), t])); }
    rebuildMap();

    function saveTags() { sv(K_TAGS, JSON.stringify(tags)); rebuildMap(); }

    function esc(s) {
        return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
    function hexRgba(hex, a) {
        const n = parseInt(hex.replace('#',''), 16);
        return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`;
    }

    // ── styles ────────────────────────────────────────────────────────────────
    function injectStyles() {
        if (document.getElementById('rtagger-styles')) return;
        const style = document.createElement('style');
        style.id = 'rtagger-styles';
        style.textContent = `
            @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&display=swap');

            :root {
                --itz-bg:     rgba(9,9,11,0.88);
                --itz-border: rgba(63,63,70,0.4);
                --itz-glass:  blur(12px);
                --itz-accent: #a78bfa;
                --itz-font:   'Rajdhani', sans-serif;
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

            #rtagger-widget .itz-title-icon  { font-size: 15px; line-height: 1; }
            #rtagger-widget .itz-title-label { font-weight: 700; font-size: 14px; letter-spacing: 0.5px; color: var(--itz-accent); flex: 1; }

            /* pill buttons in header (toggle + settings) */
            #rtagger-widget .itz-hdr-btn {
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
                flex-shrink: 0;
            }
            #rtagger-widget .itz-hdr-btn:hover { background: rgba(167,139,250,0.24); }

            /* font-size slider (settings drawer) */
            #rtagger-widget .itz-settings {
                overflow: hidden;
                max-height: 0;
                opacity: 0;
                transition: max-height 0.22s ease, opacity 0.15s ease;
            }
            #rtagger-widget .itz-settings.open {
                max-height: 60px;
                opacity: 1;
            }
            #rtagger-widget .itz-settings-inner {
                padding: 5px 0 8px;
                border-bottom: 1px solid var(--itz-border);
                margin-bottom: 8px;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            #rtagger-widget .itz-sl-lbl {
                font-size: 10px; font-weight: 700; color: #52525b;
                text-transform: uppercase; letter-spacing: .5px;
                flex-shrink: 0; width: 36px;
            }
            #rtagger-widget .itz-sl-track {
                flex: 1; height: 4px; cursor: pointer;
                accent-color: var(--itz-accent);
                border: none; outline: none; border-radius: 2px;
                background: rgba(63,63,70,0.8);
            }
            #rtagger-widget .itz-sl-val {
                font-size: 10px; font-weight: 700; color: var(--itz-accent);
                width: 28px; text-align: right; flex-shrink: 0;
            }

            #rtagger-widget .itz-section { margin-bottom: 10px; }
            #rtagger-widget .itz-section:last-child { margin-bottom: 0; }

            #rtagger-widget .rt-input {
                width: 100%; margin-top: 5px; padding: 6px 8px;
                border-radius: 6px; border: 1px solid #27272a;
                background: rgba(24,24,27,0.85); color: #f4f4f5;
                font-family: var(--itz-font); font-size: 12px; font-weight: 600;
                outline: none; box-sizing: border-box;
                transition: border-color 0.2s;
            }
            #rtagger-widget .rt-input:focus { border-color: rgba(167,139,250,0.55); }
            #rtagger-widget select.rt-input  { appearance: auto; cursor: pointer; }
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

            #rtagger-widget .rt-list {
                max-height: 130px; overflow-y: auto;
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
            #rtagger-widget .rt-item-sub  { color: #71717a; font-size: 11px; flex-shrink: 0; }
            #rtagger-widget .rt-item-btns { display: flex; gap: 3px; margin-left: auto; }
            #rtagger-widget .rt-item-edit,
            #rtagger-widget .rt-item-del {
                background: none; border: none; color: #52525b;
                cursor: pointer; font-size: 12px; padding: 0; line-height: 1;
                transition: color 0.15s; font-family: inherit;
            }
            #rtagger-widget .rt-item-edit:hover { color: var(--itz-accent); }
            #rtagger-widget .rt-item-del:hover  { color: #f87171; }

            #rtagger-widget .rt-info {
                display: flex; justify-content: space-between; align-items: center;
                font-size: 11px; color: #52525b; padding: 2px 0;
            }
            #rtagger-widget .rt-info span:last-child { color: var(--itz-accent); font-weight: 700; }

            /* badge next to username */
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

            /* neon outline on the whole auction card when seller is tagged */
            article[data-rt-card] {
                outline: 2px solid var(--rt-c) !important;
                outline-offset: 1px !important;
                box-shadow:
                    0 0 8px  2px var(--rt-c),
                    0 0 22px 4px var(--rt-g),
                    0 0 44px 8px var(--rt-gs),
                    inset 0 0 0 1px rgba(255,255,255,0.03) !important;
            }

            /* smaller neon outline on just the bidder button */
            button[data-rt-pill] {
                outline: 1.5px solid var(--rt-c) !important;
                outline-offset: 2px !important;
                border-radius: 6px !important;
                box-shadow: 0 0 6px 1px var(--rt-c), 0 0 14px 2px var(--rt-g) !important;
            }
        `;
        document.head.appendChild(style);

        // dynamic badge font size (separate so it can be updated by slider)
        const bsize = document.createElement('style');
        bsize.id = 'rtagger-badge-size';
        document.head.appendChild(bsize);
        setBadgeSize(ui_fs);
    }

    function setBadgeSize(v) {
        const el = document.getElementById('rtagger-badge-size');
        if (el) el.textContent = `.rtagger-badge { font-size: ${Math.round(v * 1.05)}px !important; }`;
    }

    // ── drag ──────────────────────────────────────────────────────────────────
    function mkDrag(titleEl, widgetEl) {
        let dragging = false, ox = 0, oy = 0;

        // restore saved position
        try {
            const saved = JSON.parse(gv(K_POS, 'null'));
            if (saved && typeof saved.x === 'number') {
                Object.assign(widgetEl.style, {
                    transition: 'none',
                    transform: 'none',
                    left:  Math.max(0, Math.min(saved.x, window.innerWidth  - 260)) + 'px',
                    top:   Math.max(0, Math.min(saved.y, window.innerHeight - 50))  + 'px',
                    right: 'auto',
                });
            }
        } catch (_) {}

        titleEl.addEventListener('pointerdown', e => {
            if (e.button !== 0 || e.target.closest('.itz-hdr-btn')) return;
            dragging = true;
            const r = widgetEl.getBoundingClientRect();
            ox = e.clientX - r.left;
            oy = e.clientY - r.top;
            Object.assign(widgetEl.style, {
                transition: 'none', transform: 'none',
                left: r.left + 'px', top: r.top + 'px', right: 'auto',
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
            sv(K_POS, JSON.stringify({ x: r.left, y: r.top }));
        });

        titleEl.addEventListener('pointercancel', () => { dragging = false; });

        window.addEventListener('resize', () => {
            const r = widgetEl.getBoundingClientRect();
            const x = Math.max(0, Math.min(r.left, window.innerWidth  - widgetEl.offsetWidth));
            const y = Math.max(0, Math.min(r.top,  window.innerHeight - widgetEl.offsetHeight));
            widgetEl.style.left = x + 'px';
            widgetEl.style.top  = y + 'px';
        }, { passive: true });
    }

    // ── context detection (v1.1 — new article-based site layout) ─────────────
    // v1.0 walked up checking Steam CDN img in children[0] — that broke.
    // v1.1: find nearest <article>, query its Seller/Highest Bidder rows by
    // label text, then check containment. WeakMap so each article is only
    // queried once no matter how many names on it match our tag list.
    const DONE = 'data-rt-done';
    const ctxCache = new WeakMap();

    function getArticleCtx(article) {
        if (ctxCache.has(article)) return ctxCache.get(article);
        let sellerBtn = null, bidderBtn = null;
        for (const row of article.querySelectorAll('.space-y-1 > div')) {
            const lbl = row.querySelector(':scope > span:first-child');
            if (!lbl) continue;
            const btn = row.querySelector(':scope > button');
            if (!btn) continue;
            const txt = lbl.textContent.trim();
            if (txt === 'Seller')          sellerBtn = btn;
            else if (txt === 'Highest Bidder') bidderBtn = btn;
        }
        const ctx = { sellerBtn, bidderBtn };
        ctxCache.set(article, ctx);
        return ctx;
    }

    function findArticle(el) {
        let cur = el, d = 0;
        while (cur && cur !== document.body && d++ < 20) {
            if (cur.tagName === 'ARTICLE') return cur;
            cur = cur.parentElement;
        }
        return null;
    }

    function getCtx(parentEl) {
        const art = findArticle(parentEl);
        if (!art) return 'other';
        const { sellerBtn, bidderBtn } = getArticleCtx(art);
        if (sellerBtn && sellerBtn.contains(parentEl))  return { type: 'seller', art };
        if (bidderBtn && bidderBtn.contains(parentEl))  return { type: 'bidder', bidderBtn };
        return { type: 'other' };
    }

    function applyCardGlow(el, tag) {
        if (!el || el.hasAttribute('data-rt-card')) return;
        el.setAttribute('data-rt-card', '1');
        el.style.setProperty('--rt-c',  tag.color);
        el.style.setProperty('--rt-g',  hexRgba(tag.color, 0.4));
        el.style.setProperty('--rt-gs', hexRgba(tag.color, 0.12));
    }
    function applyPillGlow(el, tag) {
        if (!el || el.hasAttribute('data-rt-pill')) return;
        el.setAttribute('data-rt-pill', '1');
        el.style.setProperty('--rt-c', tag.color);
        el.style.setProperty('--rt-g', hexRgba(tag.color, 0.45));
    }
    function clearGlows() {
        document.querySelectorAll('[data-rt-card]').forEach(el => {
            el.removeAttribute('data-rt-card');
            ['--rt-c','--rt-g','--rt-gs'].forEach(p => el.style.removeProperty(p));
        });
        document.querySelectorAll('[data-rt-pill]').forEach(el => {
            el.removeAttribute('data-rt-pill');
            ['--rt-c','--rt-g'].forEach(p => el.style.removeProperty(p));
        });
    }

    // ── tag scan engine ───────────────────────────────────────────────────────
    function scanRoot(root) {
        if (!root || !root.querySelectorAll || !tagMap.size) return;

        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode(node) {
                const p = node.parentElement;
                if (!p)                             return NodeFilter.FILTER_REJECT;
                if (p.closest('#rtagger-widget'))   return NodeFilter.FILTER_REJECT;
                if (p.closest('[' + DONE + ']'))    return NodeFilter.FILTER_REJECT;
                const t = p.tagName;
                if (t === 'SCRIPT' || t === 'STYLE' || t === 'NOSCRIPT') return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
            }
        });

        const hits = []; let node;
        while ((node = walker.nextNode())) {
            const text = node.textContent.trim();
            if (!text || text.length > 80) continue;
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
            try { node.after(badge); } catch (_) { parent.appendChild(badge); }

            const ctx = getCtx(parent);
            if      (ctx.type === 'seller') applyCardGlow(ctx.art, match);
            else if (ctx.type === 'bidder') applyPillGlow(ctx.bidderBtn, match);
        }
    }

    function reApplyAll() {
        document.querySelectorAll('.rtagger-badge').forEach(el => el.remove());
        document.querySelectorAll('[' + DONE + ']').forEach(el => el.removeAttribute(DONE));
        clearGlows();
        if (tagMap.size) scanRoot(document.body);
    }

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

    // ── widget ────────────────────────────────────────────────────────────────
    function buildWidget() {
        if (document.getElementById('rtagger-widget')) return;
        injectStyles();

        const widget = document.createElement('div');
        widget.id = 'rtagger-widget';
        if (ui_hidden) widget.classList.add('itz-hidden');

        // title row
        const titleRow = document.createElement('div');
        titleRow.className = 'itz-title-row';

        const icon  = document.createElement('span');
        icon.className = 'itz-title-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = '🏷';

        const label = document.createElement('span');
        label.className = 'itz-title-label';
        label.textContent = 'ITZAGUD TAGGER';

        const settingsBtn = document.createElement('button');
        settingsBtn.className = 'itz-hdr-btn';
        settingsBtn.title = 'Font size';
        settingsBtn.textContent = '⚙';

        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'itz-hdr-btn';
        toggleBtn.id = 'itz-toggle-btn';
        toggleBtn.textContent = ui_hidden ? '👁 Show' : '👁 Hide';

        titleRow.append(icon, label, settingsBtn, toggleBtn);
        mkDrag(titleRow, widget);
        widget.appendChild(titleRow);

        // settings drawer
        const settingsDiv = document.createElement('div');
        settingsDiv.className = 'itz-settings';
        const settingsInner = document.createElement('div');
        settingsInner.className = 'itz-settings-inner';
        const slLbl = document.createElement('span'); slLbl.className = 'itz-sl-lbl'; slLbl.textContent = 'Font';
        const slInp = document.createElement('input');
        slInp.type = 'range'; slInp.className = 'itz-sl-track';
        slInp.min = '9'; slInp.max = '18'; slInp.step = '1'; slInp.value = String(ui_fs);
        const slVal = document.createElement('span'); slVal.className = 'itz-sl-val'; slVal.textContent = ui_fs + 'px';
        settingsInner.append(slLbl, slInp, slVal);
        settingsDiv.appendChild(settingsInner);
        widget.appendChild(settingsDiv);

        // content
        const content = document.createElement('div');
        content.id = 'rtagger-content';

        // add form
        const sec1 = document.createElement('div'); sec1.className = 'itz-section';
        const nameInp  = document.createElement('input');
        nameInp.className = 'rt-input'; nameInp.placeholder = 'Exact username'; nameInp.autocomplete = 'off'; nameInp.spellcheck = false;
        const labelInp = document.createElement('input');
        labelInp.className = 'rt-input'; labelInp.placeholder = 'Tag label (e.g. Reseller)'; labelInp.autocomplete = 'off';
        const emojiRow = document.createElement('div'); emojiRow.className = 'rt-row';
        const emojiSel = document.createElement('select'); emojiSel.className = 'rt-input';
        ['⚠️','💰','🔥','👑','💀','✅','🛡️','⭐','🚩','🤝','🤡','😈'].forEach(e => {
            const o = document.createElement('option'); o.value = o.textContent = e; emojiSel.appendChild(o);
        });
        const colorWrap = document.createElement('div'); colorWrap.className = 'rt-color-wrap'; colorWrap.title = 'Badge color';
        const colorInp  = document.createElement('input'); colorInp.type = 'color'; colorInp.value = '#a78bfa';
        colorWrap.appendChild(colorInp);
        emojiRow.append(emojiSel, colorWrap);
        const addBtn = document.createElement('button'); addBtn.className = 'rt-btn rt-accent'; addBtn.style.marginTop = '7px'; addBtn.textContent = '＋ Add / Update Tag';
        sec1.append(nameInp, labelInp, emojiRow, addBtn);
        content.appendChild(sec1);

        // tag list
        const sec2 = document.createElement('div'); sec2.className = 'itz-section';
        const rtList = document.createElement('div'); rtList.className = 'rt-list'; rtList.id = 'rt-list';
        const rtInfo = document.createElement('div'); rtInfo.className = 'rt-info'; rtInfo.style.marginTop = '6px';
        const rtInfoL = document.createElement('span'); rtInfoL.textContent = 'Tagged users';
        const rtCount = document.createElement('span'); rtCount.id = 'rt-count'; rtCount.textContent = '0';
        rtInfo.append(rtInfoL, rtCount);
        sec2.append(rtList, rtInfo);
        content.appendChild(sec2);

        // export / import
        const sec3 = document.createElement('div'); sec3.className = 'itz-section';
        const ioRow = document.createElement('div'); ioRow.className = 'rt-io-row';
        const expBtn = document.createElement('button'); expBtn.className = 'rt-btn'; expBtn.textContent = '⬆ Export';
        const impBtn = document.createElement('button'); impBtn.className = 'rt-btn'; impBtn.textContent = '⬇ Import';
        ioRow.append(expBtn, impBtn);
        sec3.appendChild(ioRow);
        content.appendChild(sec3);

        widget.appendChild(content);
        document.body.appendChild(widget);

        // ── events ───────────────────────────────────────────────────────────

        toggleBtn.addEventListener('click', e => {
            e.stopPropagation();
            const h = widget.classList.toggle('itz-hidden');
            toggleBtn.textContent = h ? '👁 Show' : '👁 Hide';
            sv(K_HIDDEN, h ? '1' : '0');
        });

        settingsBtn.addEventListener('click', e => {
            e.stopPropagation();
            settingsDiv.classList.toggle('open');
        });

        slInp.addEventListener('input', () => {
            ui_fs = parseInt(slInp.value, 10);
            slVal.textContent = ui_fs + 'px';
            setBadgeSize(ui_fs);
            sv(K_FS, String(ui_fs));
        });

        function updateCount() {
            const el = document.getElementById('rt-count');
            if (el) el.textContent = tags.length;
        }

        function renderList() {
            const list = document.getElementById('rt-list');
            if (!list) return;
            list.innerHTML = '';
            if (!tags.length) {
                const e = document.createElement('div'); e.className = 'rt-empty'; e.textContent = 'no tags yet';
                list.appendChild(e);
                updateCount(); return;
            }
            tags.forEach((t, i) => {
                const item = document.createElement('div'); item.className = 'rt-item';
                const dot  = document.createElement('span'); dot.className = 'rt-dot'; dot.style.cssText = `background:${t.color};box-shadow:0 0 5px ${t.color}66`;
                const nm   = document.createElement('span'); nm.className = 'rt-item-name'; nm.textContent = t.emoji + ' ' + t.name;
                const sub  = document.createElement('span'); sub.className = 'rt-item-sub';  sub.textContent = t.label;
                const btns = document.createElement('span'); btns.className = 'rt-item-btns';
                const edit = document.createElement('button'); edit.className = 'rt-item-edit'; edit.title = 'Edit'; edit.textContent = '✏️';
                const del  = document.createElement('button'); del.className  = 'rt-item-del';  del.title = 'Remove'; del.textContent = '✕';
                edit.addEventListener('click', () => {
                    nameInp.value = t.name; labelInp.value = t.label; colorInp.value = t.color;
                    const o = [...emojiSel.options].find(o => o.value === t.emoji); if (o) emojiSel.value = t.emoji;
                    nameInp.focus();
                });
                del.addEventListener('click', () => { tags.splice(i, 1); saveTags(); renderList(); reApplyAll(); });
                btns.append(edit, del);
                item.append(dot, nm, sub, btns);
                list.appendChild(item);
            });
            updateCount();
        }

        addBtn.addEventListener('click', () => {
            const name  = nameInp.value.trim();
            const lbl   = labelInp.value.trim();
            nameInp.style.borderColor  = name ? '' : '#f87171';
            labelInp.style.borderColor = lbl  ? '' : '#f87171';
            if (!name || !lbl) return;
            nameInp.style.borderColor = labelInp.style.borderColor = '';
            const idx = tags.findIndex(t => t.name.toLowerCase() === name.toLowerCase());
            if (idx !== -1) tags.splice(idx, 1);
            tags.push({ name, label: lbl, emoji: emojiSel.value, color: colorInp.value });
            saveTags(); nameInp.value = labelInp.value = '';
            renderList(); reApplyAll();
        });

        [nameInp, labelInp].forEach(el => el.addEventListener('keydown', e => { if (e.key === 'Enter') addBtn.click(); }));

        expBtn.addEventListener('click', () => {
            const json = JSON.stringify(tags, null, 2);
            const orig = expBtn.textContent;
            const flash = t => { expBtn.textContent = t; setTimeout(() => expBtn.textContent = orig, 1600); };
            if (navigator.clipboard?.writeText) navigator.clipboard.writeText(json).then(() => flash('✅ Copied!')).catch(() => prompt('Copy:', json));
            else prompt('Copy:', json);
        });

        impBtn.addEventListener('click', () => {
            const raw = prompt('Paste your tags JSON:'); if (!raw) return;
            try {
                const parsed = JSON.parse(raw);
                if (!Array.isArray(parsed)) throw 0;
                parsed.forEach(t => { if (!t.name || !t.label) throw 0; t.emoji = t.emoji || '⭐'; t.color = t.color || '#a78bfa'; });
                tags = parsed; saveTags(); renderList(); reApplyAll();
            } catch (_) { alert("Couldn't import — invalid JSON."); }
        });

        renderList();
    }

    // ── boot ──────────────────────────────────────────────────────────────────
    function boot() {
        buildWidget();
        requestAnimationFrame(() => {
            scanRoot(document.body);
            observer.observe(document.body, { childList: true, subtree: true });
        });
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(boot, 400);
    } else {
        document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 400));
    }

})();
