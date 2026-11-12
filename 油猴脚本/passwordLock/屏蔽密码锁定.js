// ==UserScript==
// @name         屏蔽密码锁定
// @namespace    local.anti.passwordlock
// @version      0.2.3
// @description  屏蔽密码锁定扩展
// @author       诺言Promise
// @match        https://turbowarp.org/*
// @match        https://editor.02engine.org/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const TARGET_ID = 'passwordLock';
    const TARGET_NAME = '密码锁定';

    let hooked = false;

    function isTarget(ext) {
        try {
            const info = ext && typeof ext.getInfo === 'function' ? ext.getInfo() : null;
            return !!info && (info.id === TARGET_ID || info.name === TARGET_NAME);
        } catch (e) {
            return false;
        }
    }

    function removeOverlay() {
        try {
            const overlay = document.getElementById('tw-password-overlay');
            if (overlay && overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
        } catch (e) {}
    }

    function neutralize(ext) {
        if (!ext || ext.__antiPasswordLock) return;
        try { ext.__antiPasswordLock = true; } catch (e) {}

        removeOverlay();

        try {
            const vm = window.Scratch && window.Scratch.vm;
            if (vm && ext.projectLoadListener) {
                vm.off('PROJECT_RUN_START', ext.projectLoadListener);
                ext.projectLoadListener = null;
            }
            if (vm && vm.runtime && typeof vm.runtime.off === 'function') {
                if (ext._listeners) {
                    for (const event in ext._listeners) {
                        if (Array.isArray(ext._listeners[event])) {
                            ext._listeners[event].forEach(fn => vm.runtime.off(event, fn));
                        }
                    }
                }
            }
        } catch (e) {}

        const noop = function () {};
        const noopAsync = async function () {};

        const methodsToNeutralize = [
            'setPassword',
            'clearPassword',
            'scheduleLock',
            'createOverlay',
            'showOverlay',
            'showPasswordScreen',
            'hidePasswordScreen'
        ];

        for (const name of methodsToNeutralize) {
            try {
                if (typeof ext[name] === 'function') {
                    ext[name] = function () {};
                }
            } catch (e) {
                try {
                    Object.defineProperty(ext, name, {
                        value: noop,
                        configurable: true,
                        writable: true
                    });
                } catch (e2) {}
            }
        }

        try { if (ext._lockTimer) clearTimeout(ext._lockTimer); } catch (e) {}
        try { if (ext._focusTimer) clearTimeout(ext._focusTimer); } catch (e) {}

        try {
            if (ext.storedPassword !== undefined) ext.storedPassword = null;
            if (ext.password !== undefined) ext.password = null;
        } catch (e) {}

        removeOverlay();
    }

    function neutralizeExisting() {
        try {
            const em = window.Scratch && window.Scratch.extensions;
            if (!em) return;

            const candidates = [
                em._loadedExtensions,
                em._extensions,
                em.extensions,
                em._registeredExtensions,
                em._extensionInstances,
                em._extensionList
            ];

            for (const item of candidates) {
                if (!item) continue;

                if (typeof item.forEach === 'function') {
                    item.forEach(function (ext) {
                        if (isTarget(ext)) neutralize(ext);
                    });
                } else if (Array.isArray(item)) {
                    item.forEach(function (ext) {
                        if (isTarget(ext)) neutralize(ext);
                    });
                } else if (typeof item === 'object') {
                    for (const key in item) {
                        const ext = item[key];
                        if (isTarget(ext)) neutralize(ext);
                    }
                }
            }
        } catch (e) {}
    }

    function hookScratch(Scratch) {
        if (!Scratch || !Scratch.extensions || hooked) return;

        const originalRegister = Scratch.extensions.register;
        if (typeof originalRegister !== 'function') return;

        hooked = true;

        Scratch.extensions.register = function (ext) {
            if (isTarget(ext)) {
                neutralize(ext);
            }
            return originalRegister.apply(this, arguments);
        };

        try {
            const runtime = Scratch.vm && Scratch.vm.runtime;
            if (runtime && typeof runtime.on === 'function') {
                runtime.on('PROJECT_LOADED', function () {
                    removeOverlay();
                    neutralizeExisting();
                });
                runtime.on('PROJECT_RUN_START', function () {
                    removeOverlay();
                    neutralizeExisting();
                });
                runtime.on('PROJECT_STOP', function () {
                    removeOverlay();
                });
            }
        } catch (e) {}

        neutralizeExisting();
        removeOverlay();
    }

    function tryHook() {
        if (window.Scratch) hookScratch(window.Scratch);
        if (hooked) {
            neutralizeExisting();
            removeOverlay();
        }
    }

    tryHook();
    const timer = setInterval(function () {
        tryHook();
        if (hooked) clearInterval(timer);
    }, 10);

    try {
        const originalAppendChild = Node.prototype.appendChild;
        Node.prototype.appendChild = function (child) {
            try {
                if (child && child.id === 'tw-password-overlay') {
                    return child;
                }
            } catch (e) {}
            return originalAppendChild.apply(this, arguments);
        };
    } catch (e) {}

    try {
        const originalInsertBefore = Node.prototype.insertBefore;
        Node.prototype.insertBefore = function (newNode, referenceNode) {
            try {
                if (newNode && newNode.id === 'tw-password-overlay') {
                    return newNode;
                }
            } catch (e) {}
            return originalInsertBefore.apply(this, arguments);
        };
    } catch (e) {}

    setInterval(function () {
        removeOverlay();
    }, 500);
})();