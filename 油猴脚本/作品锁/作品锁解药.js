// ==UserScript==
// @name         作品锁解药
// @namespace    local.anti.ransom
// @version      0.1.7
// @description  作品锁破解药
// @author       诺言Promise
// @match        https://turbowarp.org/*
// @match        https://editor.02engine.org/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const TARGET_ID = 'projectLockingv2';
  const TARGET_NAME = '作品锁';
  const SHARD_VARS = ['_d1', '_d2', '_d3', '_d4', '_d5', '_d6'];

  let hooked = false;

  function isTarget(ext) {
    try {
      const info = ext && typeof ext.getInfo === 'function' ? ext.getInfo() : null;
      return !!info && (info.id === TARGET_ID || info.name === TARGET_NAME);
    } catch (e) {
      return false;
    }
  }

  function clearShardVars() {
    try {
      const S = window.Scratch;
      const runtime = S && S.vm && S.vm.runtime;
      const stage = runtime && runtime.getTargetForStage && runtime.getTargetForStage();
      if (!stage || typeof stage.lookupVariableByNameAndType !== 'function') return;

      for (const name of SHARD_VARS) {
        const v = stage.lookupVariableByNameAndType(name, '');
        if (v) v.value = '';
      }
    } catch (e) {}
  }

  function neutralize(ext) {
    if (!ext || ext.__antiProjectLockingV2) return;
    try { ext.__antiProjectLockingV2 = true; } catch (e) {}

    const noop = function () {};
    const noopAsync = async function () { return false; };

    const methods = {

      createIframePasswordScreen: noop,
      showPasswordScreen: noop,
      hidePasswordScreen: noop,
      showPermanentLockScreen: noop,
      triggerSelfDestruct: noopAsync,
      spawnStageWarning: noop,
      startDevtoolsGuard: noop,
      preventEscapeAndTamper: noop,
      preventAll: noop,
      removeEventListeners: noop,
      removeIframe: noop,
      handleProjectLoad: noopAsync,
      verifyIframePwd: noopAsync,
      isDevtoolsOpen: async function () { return false; },


      setProjectPassword: noopAsync,
      getCurrentPassword: async function () { return ''; },
      encryptProjectPassword: async function () { return ''; },
      enablePasswordProtection: noop,
      disablePasswordProtection: noop,
      enableForPackaged: noop,
      disableForPackaged: noop,
      isPackagedProject: function () { return false; },
      isPasswordProtected: async function () { return false; },
      setShardsToVars: noop,
      clearShardVars: noop,
      setVariable: noop,
      getVariable: function () { return null; },


      deriveKeyFromPassword: async function () { return null; },
      encryptPayloadJSON: async function () { return { shards: [] }; },
      decryptShardsFromVars: async function () { return null; }
    };

    for (const name in methods) {
      try {
        ext[name] = methods[name];
      } catch (e) {
        try {
          Object.defineProperty(ext, name, {
            value: methods[name],
            configurable: true,
            writable: true
          });
        } catch (e2) {}
      }
    }


    try { if (ext.devtoolsTimer) clearInterval(ext.devtoolsTimer); } catch (e) {}
    try { if (ext.observer) ext.observer.disconnect(); } catch (e) {}
    try {
      if (ext.iframeOverlay && ext.iframeOverlay.parentNode) {
        ext.iframeOverlay.parentNode.removeChild(ext.iframeOverlay);
      }
    } catch (e) {}

    ext.devtoolsTimer = null;
    ext.observer = null;
    ext.iframeOverlay = null;
    ext.passwordEnabled = false;
    ext.encryptionKeyRaw = '';
    ext.encryptedPayloadShards = [];

    clearShardVars();
    console.warn('已经中和作品锁');
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
        em._extensionInstances
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
          clearShardVars();
          neutralizeExisting();
        });
      }
    } catch (e) {}

    neutralizeExisting();
    clearShardVars();
    console.info('已安装');
  }

  function tryHook() {
    if (window.Scratch) hookScratch(window.Scratch);
    if (hooked) {
      neutralizeExisting();
      clearShardVars();
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
        if (child && child.tagName === 'IFRAME' && child.style) {
          const z = parseInt(child.style.zIndex || '0', 10);
          if (child.style.position === 'fixed' && z > 2147483000) {
            console.warn('已阻止全屏');
            return child;
          }
        }
      } catch (e) {}

      return originalAppendChild.apply(this, arguments);
    };
  } catch (e) {}
})();