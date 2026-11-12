// ==UserScript==
// @name         模拟打包环境
// @namespace    http://tampermonkey.net/
// @version      1.2.2
// @description  用于模拟打包作品环境，欺骗真实打包检测扩展
// @author       诺言Promise
// @match        *://*/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    const HOSTS = ['assets.scratch.mit.edu','projects.scratch.mit.edu','cdn.assets.scratch.mit.edu','api.scratch.mit.edu','turbowarp.org'];
    const _isScratch = function (u) {
        if (!u) return false;
        const s = String(u);
        for (let i = 0; i < HOSTS.length; i++) if (s.indexOf(HOSTS[i]) !== -1) return true;
        return false;
    };

    const patchedFns = new WeakSet();
    const blockedPatterns = ['tampermonkey','greasemonkey','violentmonkey','scriptcat','chrome-extension://','moz-extension://','safari-extension://'];

    function isBlockedUrl(u) {
        if (!u) return false;
        const s = String(u).toLowerCase();
        for (let i = 0; i < blockedPatterns.length; i++) if (s.indexOf(blockedPatterns[i]) !== -1) return true;
        return false;
    }

    function isBadEl(el) {
        try {
            if (!el || !el.tagName) return false;
            const tag = String(el.tagName).toUpperCase();
            if (tag === 'SCRIPT' || tag === 'LINK' || tag === 'IFRAME') {
                if (isBlockedUrl(el.src) || isBlockedUrl(el.href)) return true;
            }
            return false;
        } catch (e) { return false; }
    }

    function killGlobal(name) {
        try {
            const d = Object.getOwnPropertyDescriptor(window, name);
            if (!d) return;
            if (d.configurable) {
                try { delete window[name]; } catch (e) {}
                if (window[name] !== undefined) {
                    try { Reflect.deleteProperty(window, name); } catch (e) {}
                }
            }
        } catch (e) {}
    }
    killGlobal('GM_info');
    killGlobal('GM');
    killGlobal('unsafeWindow');
    killGlobal('GM_xmlhttpRequest');
    killGlobal('GM_setValue');
    killGlobal('GM_getValue');
    killGlobal('GM_deleteValue');
    killGlobal('GM_listValues');
    killGlobal('GM_addStyle');
    killGlobal('GM_notification');
    killGlobal('GM_openInTab');
    killGlobal('GM_registerMenuCommand');
    killGlobal('GM_unregisterMenuCommand');
    killGlobal('GM_getResourceText');
    killGlobal('GM_getResourceURL');
    killGlobal('GM_download');
    killGlobal('GM_cookie');
    killGlobal('GM_webRequest');
    killGlobal('GM_log');
    killGlobal('GM_addElement');

    try {
        if (window.chrome && window.chrome.runtime) {
            try {
                Object.defineProperty(window.chrome, 'runtime', {
                    value: undefined, writable: true, configurable: true, enumerable: false
                });
            } catch (e) {}
        }
    } catch (e) {}
    try {
        if (window.browser && window.browser.runtime) {
            try {
                Object.defineProperty(window.browser, 'runtime', {
                    value: undefined, writable: true, configurable: true, enumerable: false
                });
            } catch (e) {}
        }
    } catch (e) {}

    function scrubNow() {
        try {
            const root = document.documentElement;
            if (!root) return;
            const all = root.getElementsByTagName('*');
            const doomed = [];
            for (let i = 0; i < all.length; i++) {
                if (isBadEl(all[i])) doomed.push(all[i]);
            }
            for (let i = 0; i < doomed.length; i++) {
                try {
                    const el = doomed[i];
                    if (el.parentNode) el.parentNode.removeChild(el);
                } catch (e) {}
            }
        } catch (e) {}
    }
    try { scrubNow(); } catch (e) {}

    try {
        const target = document.documentElement || document;
        const obs = new MutationObserver(function () { scrubNow(); });
        obs.observe(target, { childList: true, subtree: true });
        setTimeout(function () { try { obs.disconnect(); } catch (e) {} }, 60000);
    } catch (e) {}

    function makeProxyFn(orig, handler) {
        if (patchedFns.has(orig)) return orig;
        const proxy = new Proxy(orig, {
            apply: function (t, thisArg, args) {
                return handler(t, thisArg, args, orig);
            }
        });
        patchedFns.add(proxy);
        return proxy;
    }

    function filterCollection(orig, thisArg, args) {
        const result = Reflect.apply(orig, thisArg, args);
        if (!result) return result;
        try {
            if (result instanceof HTMLCollection || result instanceof NodeList || (typeof result.length === 'number' && result.item)) {
                const out = [];
                for (let i = 0; i < result.length; i++) {
                    const el = result[i];
                    if (isBadEl(el)) continue;
                    out.push(el);
                }
                return out;
            }
        } catch (e) {}
        return result;
    }

    try {
        const proto = Document.prototype;
        const tagFn = proto.getElementsByTagName;
        if (tagFn && !patchedFns.has(tagFn)) proto.getElementsByTagName = makeProxyFn(tagFn, filterCollection);
        const clsFn = proto.getElementsByClassName;
        if (clsFn && !patchedFns.has(clsFn)) proto.getElementsByClassName = makeProxyFn(clsFn, filterCollection);
        const nameFn = proto.getElementsByName;
        if (nameFn && !patchedFns.has(nameFn)) proto.getElementsByName = makeProxyFn(nameFn, filterCollection);
    } catch (e) {}

    try {
        const eProto = Element.prototype;
        const eTag = eProto.getElementsByTagName;
        if (eTag && !patchedFns.has(eTag)) eProto.getElementsByTagName = makeProxyFn(eTag, filterCollection);
        const eCls = eProto.getElementsByClassName;
        if (eCls && !patchedFns.has(eCls)) eProto.getElementsByClassName = makeProxyFn(eCls, filterCollection);
    } catch (e) {}

    try {
        const _qs = Document.prototype.querySelector;
        const _qsa = Document.prototype.querySelectorAll;
        const _qsE = Element.prototype.querySelector;
        const _qsaE = Element.prototype.querySelectorAll;

        function isBlockedSelector(sel) {
            if (!sel) return false;
            const s = String(sel).toLowerCase();
            for (let i = 0; i < blockedPatterns.length; i++) {
                if (s.indexOf(blockedPatterns[i]) !== -1) return true;
            }
            return false;
        }
        function makeQueryProxy(orig, retNull) {
            if (patchedFns.has(orig)) return orig;
            const proxy = new Proxy(orig, {
                apply: function (t, thisArg, args) {
                    if (args.length > 0 && isBlockedSelector(args[0])) {
                        return retNull ? null : [];
                    }
                    return Reflect.apply(t, thisArg, args);
                }
            });
            patchedFns.add(proxy);
            return proxy;
        }
        Document.prototype.querySelector = makeQueryProxy(_qs, true);
        Document.prototype.querySelectorAll = makeQueryProxy(_qsa, false);
        Element.prototype.querySelector = makeQueryProxy(_qsE, true);
        Element.prototype.querySelectorAll = makeQueryProxy(_qsaE, false);
    } catch (e) {}

    try {
        const childrenDesc = Object.getOwnPropertyDescriptor(Element.prototype, 'children');
        if (childrenDesc && childrenDesc.get) {
            const origGet = childrenDesc.get;
            Object.defineProperty(Element.prototype, 'children', {
                get: function () {
                    const r = origGet.call(this);
                    try {
                        const out = [];
                        for (let i = 0; i < r.length; i++) if (!isBadEl(r[i])) out.push(r[i]);
                        return out;
                    } catch (e) { return r; }
                },
                configurable: true, enumerable: childrenDesc.enumerable
            });
        }
    } catch (e) {}

    try {
        const childNodesDesc = Object.getOwnPropertyDescriptor(Node.prototype, 'childNodes');
        if (childNodesDesc && childNodesDesc.get) {
            const origGet = childNodesDesc.get;
            Object.defineProperty(Node.prototype, 'childNodes', {
                get: function () {
                    const r = origGet.call(this);
                    try {
                        const out = [];
                        for (let i = 0; i < r.length; i++) if (!isBadEl(r[i])) out.push(r[i]);
                        return out;
                    } catch (e) { return r; }
                },
                configurable: true, enumerable: childNodesDesc.enumerable
            });
        }
    } catch (e) {}

    try {
        let wd = false;
        try { wd = navigator.webdriver; } catch (e) {}
        if (wd) {
            let ok = false;
            try {
                Object.defineProperty(navigator, 'webdriver', {
                    value: false, configurable: true, enumerable: true, writable: false
                });
                ok = navigator.webdriver === false;
            } catch (e) {}
            if (!ok) {
                try {
                    const navProxy = new Proxy(navigator, {
                        get: function (t, p) {
                            if (p === 'webdriver') return false;
                            return Reflect.get(t, p);
                        }
                    });
                    Object.defineProperty(window, 'navigator', {
                        get: function () { return navProxy; },
                        configurable: true, enumerable: true
                    });
                } catch (e) {}
            }
        }
    } catch (e) {}

    try {
        const p = navigator.plugins;
        if (p && p.length > 0) {
            try {
                Object.defineProperty(navigator, 'plugins', {
                    value: [], writable: false, configurable: true, enumerable: true
                });
            } catch (e) {}
        }
    } catch (e) {}

    function Scaffolding() {
        this.projectId = null;
        this.cloudVariables = [];
        this.version = '1.0.0';
    }
    Object.defineProperty(Scaffolding, 'name', { value: 'Scaffolding', configurable: true });
    Scaffolding.prototype.setup = function setup() { return this; };
    Scaffolding.prototype.appendTo = function appendTo(parent) { return this; };
    Scaffolding.prototype.addAfterProjects = function () { return this; };
    Scaffolding.prototype.getProjectId = function getProjectId() { var id = this.projectId; return id; };
    Scaffolding.prototype.canAddCloudVariable = function () { return true; };
    Scaffolding.prototype.addCloudVariable = function () { return {}; };
    Scaffolding.prototype.removeCloudVariable = function () {};
    Scaffolding.prototype.projectLoaded = function () { return this; };
    Scaffolding.prototype.getVersion = function () { var v = this.version; return v; };

    try {
        const ex = window.scaffolding;
        const needReplace = (typeof ex === 'undefined') ||
            (ex && Object.getPrototypeOf(ex) === Object.prototype) ||
            (ex && ex.constructor && ex.constructor.name !== 'Scaffolding');
        if (needReplace) {
            const inst = new Scaffolding();
            try {
                Object.defineProperty(window, 'scaffolding', {
                    value: inst, writable: false, configurable: true, enumerable: true
                });
            } catch (e) { window.scaffolding = inst; }
        }
    } catch (e) {}

    const _filterEntries = function (arr) {
        if (!Array.isArray(arr)) return arr;
        const out = [];
        for (let i = 0; i < arr.length; i++) {
            const en = arr[i];
            if (en && _isScratch(en.name)) continue;
            out.push(en);
        }
        return out;
    };

    function patchPerfProto() {
        try {
            const proto = Performance.prototype;
            if (!proto) return;
            const wrapMethod = function (orig) {
                if (!orig || patchedFns.has(orig)) return orig;
                const proxy = new Proxy(orig, {
                    apply: function (t, thisArg, args) {
                        return _filterEntries(Reflect.apply(t, thisArg, args));
                    }
                });
                patchedFns.add(proxy);
                return proxy;
            };
            const _byType = proto.getEntriesByType;
            if (_byType && !patchedFns.has(_byType)) proto.getEntriesByType = wrapMethod(_byType);
            const _all = proto.getEntries;
            if (_all && !patchedFns.has(_all)) proto.getEntries = wrapMethod(_all);
            const _byName = proto.getEntriesByName;
            if (_byName && !patchedFns.has(_byName)) proto.getEntriesByName = wrapMethod(_byName);
        } catch (e) {}
    }
    patchPerfProto();
    const perfGuard = setInterval(() => {
        try { if (!patchedFns.has(Performance.prototype.getEntriesByType)) patchPerfProto(); } catch (e) {}
    }, 500);
    setTimeout(() => clearInterval(perfGuard), 60000);

    function lockXhrOpen() {
        try {
            const XHR = window.XMLHttpRequest;
            if (!XHR || !XHR.prototype) return;
            const proto = XHR.prototype;
            const d = Object.getOwnPropertyDescriptor(proto, 'open');
            if (d && d.value && patchedFns.has(d.value)) return;
            if (d && d.configurable === false && !(d.value && patchedFns.has(d.value))) return;
            let _open = d && d.value ? d.value : proto.open;
            if (!patchedFns.has(_open)) {
                const proxy = new Proxy(_open, {
                    apply: function (t, thisArg, args) { return Reflect.apply(t, thisArg, args); }
                });
                patchedFns.add(proxy);
                _open = proxy;
            }
            try {
                Object.defineProperty(proto, 'open', {
                    value: _open, writable: false, configurable: true, enumerable: true
                });
            } catch (e) {}
        } catch (e) {}
    }
    lockXhrOpen();

    try {
        const nf = window.fetch;
        if (nf && !patchedFns.has(nf)) {
            const proxy = new Proxy(nf, {
                apply: function (t, thisArg, args) { return Reflect.apply(t, thisArg, args); }
            });
            patchedFns.add(proxy);
            window.fetch = proxy;
        }
    } catch (e) {}

    const _refMap = new WeakMap();
    const _check = function (r) {
        if (!r) return false;
        if (!_refMap.has(r)) return false;
        const ref = _refMap.get(r);
        if (!ref) return false;
        try { return r.storage !== ref; } catch (e) { return false; }
    };
    let FakeGetter = null;
    try {
        FakeGetter = new Function('c',
            'return function(){try{var s=this.projectLoaded;return c(this)?false:true;}catch(e){return true;}}'
        )(_check);
    } catch (e) {
        FakeGetter = function () { return true; };
    }

    function patchRuntime(runtime) {
        try {
            if (!runtime) return;
            try { _refMap.set(runtime, runtime.storage); } catch (e) {}
            const d = Object.getOwnPropertyDescriptor(runtime, 'isPackaged');
            if (d && d.get && d.get === FakeGetter) return;
            Object.defineProperty(runtime, 'isPackaged', {
                get: FakeGetter, set() {}, configurable: true, enumerable: true
            });
        } catch (e) {
            try { runtime.isPackaged = true; } catch (err) {}
        }
    }

    function patchRuntimePackaged() {
        if (typeof window.Scratch === 'undefined' || !window.Scratch.vm) return false;
        const vm = window.Scratch.vm;
        if (vm.runtime) { patchRuntime(vm.runtime); return true; }
        try {
            let _rt = vm.runtime;
            Object.defineProperty(vm, 'runtime', {
                get() { return _rt; },
                set(v) { _rt = v; if (v) patchRuntime(v); },
                configurable: true, enumerable: true
            });
        } catch (e) {
            const iv = setInterval(() => {
                if (vm.runtime) { patchRuntime(vm.runtime); clearInterval(iv); }
            }, 50);
            setTimeout(() => clearInterval(iv), 30000);
        }
        return true;
    }

    if (!patchRuntimePackaged()) {
        let n = 0;
        const iv = setInterval(() => {
            n++;
            if (patchRuntimePackaged() || n >= 200) clearInterval(iv);
        }, 100);
    }

    setInterval(() => {
        try {
            if (window.Scratch && window.Scratch.vm && window.Scratch.vm.runtime) {
                if (window.Scratch.vm.runtime.isPackaged !== true) {
                    patchRuntime(window.Scratch.vm.runtime);
                }
            }
        } catch (e) {}
    }, 1000);

})();