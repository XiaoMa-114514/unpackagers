// ==UserScript==
// @name         模拟打包环境
// @namespace    http://tampermonkey.net/
// @version      1.4.0
// @description  模拟打包环境，欺骗真实打包检测扩展
// @author       诺言Promise
// @match        *://*/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    const GM_KEYS = ['GM_info','GM','unsafeWindow','GM_xmlhttpRequest','GM_setValue','GM_getValue',
        'GM_deleteValue','GM_listValues','GM_addStyle','GM_notification','GM_openInTab',
        'GM_registerMenuCommand','GM_unregisterMenuCommand','GM_getResourceText',
        'GM_getResourceURL','GM_download','GM_cookie','GM_webRequest','GM_log','GM_addElement'];

    function killGlobals() {
        for (let i = 0; i < GM_KEYS.length; i++) {
            try {
                const d = Object.getOwnPropertyDescriptor(window, GM_KEYS[i]);
                if (d && d.configurable) {
                    try { delete window[GM_KEYS[i]]; } catch (e) {}
                }
            } catch (e) {}
        }
    }

    function killRuntimeRefs() {
        try {
            if (window.chrome && window.chrome.runtime) {
                try { Object.defineProperty(window.chrome, 'runtime', { value: undefined, writable: true, configurable: true, enumerable: false }); } catch (e) {}
            }
        } catch (e) {}
        try {
            if (window.browser && window.browser.runtime) {
                try { Object.defineProperty(window.browser, 'runtime', { value: undefined, writable: true, configurable: true, enumerable: false }); } catch (e) {}
            }
        } catch (e) {}
    }

    killGlobals();
    killRuntimeRefs();

    const host = String(location.hostname || '').toLowerCase();
    const isGandi = host.indexOf('ccw.site') !== -1 || host.indexOf('cocrea.world') !== -1;

    if (isGandi) {
        injectGandiPackagerMock();
        return;
    }

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
            if (!el || el.nodeType !== 1) return false;
            const tag = String(el.tagName).toUpperCase();
            if (tag === 'SCRIPT' || tag === 'LINK' || tag === 'IFRAME') {
                if (isBlockedUrl(el.src) || isBlockedUrl(el.href)) return true;
            }
            return false;
        } catch (e) { return false; }
    }

    const nativeChildNodes = Object.getOwnPropertyDescriptor(Node.prototype, 'childNodes').get;
    const nativeRemoveChild = Node.prototype.removeChild;

    function scrubTree(root) {
        if (!root) return;
        let kids;
        try { kids = nativeChildNodes.call(root); } catch (e) { return; }
        if (!kids) return;
        const arr = [];
        for (let i = 0; i < kids.length; i++) arr.push(kids[i]);
        for (let i = 0; i < arr.length; i++) {
            const el = arr[i];
            if (isBadEl(el)) {
                try { nativeRemoveChild.call(el.parentNode, el); } catch (e) {}
                continue;
            }
            if (el.nodeType === 1) scrubTree(el);
        }
    }

    try { scrubTree(document); } catch (e) {}
    try {
        document.addEventListener('DOMContentLoaded', function () {
            try { scrubTree(document); } catch (e) {}
        }, { once: true });
    } catch (e) {}

    function isBlockedSelector(sel) {
        if (!sel) return false;
        const s = String(sel).toLowerCase();
        for (let i = 0; i < blockedPatterns.length; i++) if (s.indexOf(blockedPatterns[i]) !== -1) return true;
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
    try {
        Document.prototype.querySelector = makeQueryProxy(Document.prototype.querySelector, true);
        Document.prototype.querySelectorAll = makeQueryProxy(Document.prototype.querySelectorAll, false);
        Element.prototype.querySelector = makeQueryProxy(Element.prototype.querySelector, true);
        Element.prototype.querySelectorAll = makeQueryProxy(Element.prototype.querySelectorAll, false);
    } catch (e) {}

    try {
        let wd = false;
        try { wd = navigator.webdriver; } catch (e) {}
        if (wd) {
            try {
                Object.defineProperty(navigator, 'webdriver', { value: false, configurable: true, enumerable: true, writable: false });
            } catch (e) {}
        }
    } catch (e) {}

    try {
        const p = navigator.plugins;
        if (p && p.length > 0) {
            try { Object.defineProperty(navigator, 'plugins', { value: [], writable: false, configurable: true, enumerable: true }); } catch (e) {}
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
    Scaffolding.prototype.getProjectId = function getProjectId() { return this.projectId; };
    Scaffolding.prototype.canAddCloudVariable = function () { return true; };
    Scaffolding.prototype.addCloudVariable = function () { return {}; };
    Scaffolding.prototype.removeCloudVariable = function () {};
    Scaffolding.prototype.projectLoaded = function () { return this; };
    Scaffolding.prototype.getVersion = function () { return this.version; };

    try {
        const ex = window.scaffolding;
        const needReplace = (typeof ex === 'undefined') ||
            (ex && Object.getPrototypeOf(ex) === Object.prototype) ||
            (ex && ex.constructor && ex.constructor.name !== 'Scaffolding');
        if (needReplace) {
            const inst = new Scaffolding();
            try {
                Object.defineProperty(window, 'scaffolding', { value: inst, writable: false, configurable: true, enumerable: true });
            } catch (e) { window.scaffolding = inst; }
        }
    } catch (e) {}

    function _filterEntries(arr) {
        if (!Array.isArray(arr)) return arr;
        const out = [];
        for (let i = 0; i < arr.length; i++) {
            const en = arr[i];
            if (en && _isScratch(en.name)) continue;
            out.push(en);
        }
        return out;
    }
    function patchPerfProto() {
        try {
            const proto = Performance.prototype;
            if (!proto) return;
            const wrap = function (orig) {
                if (!orig || patchedFns.has(orig)) return orig;
                const proxy = new Proxy(orig, {
                    apply: function (t, thisArg, args) {
                        return _filterEntries(Reflect.apply(t, thisArg, args));
                    }
                });
                patchedFns.add(proxy);
                return proxy;
            };
            if (proto.getEntriesByType && !patchedFns.has(proto.getEntriesByType)) proto.getEntriesByType = wrap(proto.getEntriesByType);
            if (proto.getEntries && !patchedFns.has(proto.getEntries)) proto.getEntries = wrap(proto.getEntries);
            if (proto.getEntriesByName && !patchedFns.has(proto.getEntriesByName)) proto.getEntriesByName = wrap(proto.getEntriesByName);
        } catch (e) {}
    }
    patchPerfProto();

    const _storageMap = new WeakMap();

    function patchRuntime(runtime) {
        try {
            if (!runtime) return;
            if (_storageMap.has(runtime)) return;
            _storageMap.set(runtime, runtime.storage);
            const d = Object.getOwnPropertyDescriptor(runtime, 'isPackaged');
            if (d && d.get && d.get.__isPackagedFake) return;
            const getter = function () {
                try {
                    const ref = _storageMap.get(runtime);
                    if (ref && runtime.storage !== ref) return false;
                } catch (e) {}
                return true;
            };
            getter.__isPackagedFake = true;
            Object.defineProperty(runtime, 'isPackaged', { get: getter, set() {}, configurable: true, enumerable: true });
        } catch (e) {
            try { runtime.isPackaged = true; } catch (err) {}
        }
    }

    function patchRuntimePackaged() {
        if (typeof window.Scratch === 'undefined' || !window.Scratch.vm) return false;
        const vm = window.Scratch.vm;
        if (vm.runtime) { patchRuntime(vm.runtime); return true; }
        return false;
    }
    patchRuntimePackaged();

    const timers = [];
    function addInterval(fn, ms) {
        const id = setInterval(fn, ms);
        timers.push(id);
        return id;
    }
    function clearAll() { timers.forEach(function (id) { clearInterval(id); }); timers.length = 0; }
    window.addEventListener('pagehide', clearAll, { once: true });
    window.addEventListener('beforeunload', clearAll, { once: true });

    let tries = 0;
    const vmTimer = addInterval(function () {
        tries++;
        if (patchRuntimePackaged() || tries >= 200) {
            clearInterval(vmTimer);
            const idx = timers.indexOf(vmTimer);
            if (idx !== -1) timers.splice(idx, 1);
        }
    }, 100);

    let perfTries = 0;
    const perfTimer = addInterval(function () {
        perfTries++;
        try {
            if (!patchedFns.has(Performance.prototype.getEntriesByType)) patchPerfProto();
        } catch (e) {}
        if (perfTries >= 60) {
            clearInterval(perfTimer);
            const idx = timers.indexOf(perfTimer);
            if (idx !== -1) timers.splice(idx, 1);
        }
    }, 1000);

    function injectGandiPackagerMock() {
        const MOCK_APIS = {
            getReleaseInfo: function () {
                return Promise.resolve({
                    projectLink: 'https://www.ccw.site/',
                    videoLink: '',
                    coverLink: '',
                    version: '1.0.0',
                    customVersion: '1.0.0',
                    description: '模拟打包环境',
                    operatingInstruction: '',
                    submittedAt: new Date().toISOString(),
                    tags: [],
                    packagedAt: new Date().toISOString()
                });
            },
            setPaused: function (paused) {
                return Promise.resolve();
            },
            closeWindow: function () {
                return Promise.resolve();
            }
        };

        function ensureMock() {
            try {
                if (typeof window.Scratch === 'undefined') return false;
                if (!window.Scratch.runtime) return false;

                const rt = window.Scratch.runtime;

                if (!rt.ccwAPI || typeof rt.ccwAPI.getOnlineExtensionsConfig !== 'function') {
                    rt.ccwAPI = rt.ccwAPI || {};
                    rt.ccwAPI.getOnlineExtensionsConfig = function () {
                        return {
                            'GandiPackager': {
                                api: MOCK_APIS
                            }
                        };
                    };
                } else {
                    const orig = rt.ccwAPI.getOnlineExtensionsConfig;
                    rt.ccwAPI.getOnlineExtensionsConfig = function () {
                        const cfg = orig.apply(this, arguments) || {};
                        if (!cfg['GandiPackager']) {
                            cfg['GandiPackager'] = { api: MOCK_APIS };
                        }
                        return cfg;
                    };
                }

                try {
                    rt.emit('CCWAPI_CHANGED');
                } catch (e) {}

                return true;
            } catch (e) {
                return false;
            }
        }

        if (!ensureMock()) {
            let n = 0;
            const iv = setInterval(function () {
                n++;
                if (ensureMock() || n >= 300) clearInterval(iv);
            }, 100);
            window.addEventListener('pagehide', function () { clearInterval(iv); }, { once: true });
        }
    }

})();