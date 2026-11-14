// ==UserScript==
// @name         反按键劫持
// @namespace    http://tampermonkey.net/
// @version      0.1.1
// @description  阻止网页劫持浏览器快捷键
// @author       诺言Promise
// @match        *://*/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    const SAFE_KEYS = [
        'f12', 'f11', 'f5',
        'ctrl+shift+i', 'ctrl+shift+j', 'ctrl+u', 'ctrl+s',
        'ctrl+shift+c', 'ctrl+shift+k'
    ];

    const originalPreventDefault = Event.prototype.preventDefault;

    Event.prototype.preventDefault = function() {
        if (this instanceof KeyboardEvent) {
            const combo = getCombo(this);
            const simple = getSimple(this);

            if (SAFE_KEYS.includes(combo) || SAFE_KEYS.includes(simple)) {
                return;
            }
        }

        return originalPreventDefault.apply(this, arguments);
    };

    function getSimple(e) {
        let k = e.key;
        if (/^F\d+$/.test(k)) return k.toLowerCase();
        if (k.length === 1) return k.toLowerCase();
        const map = {
            ' ': 'space', 'Escape': 'escape', 'Control': 'control',
            'Shift': 'shift', 'Alt': 'alt', 'Meta': 'meta',
            'Tab': 'tab', 'Enter': 'enter',
            'ArrowUp': 'up', 'ArrowDown': 'down', 'ArrowLeft': 'left', 'ArrowRight': 'right'
        };
        return map[k] || k.toLowerCase();
    }

    function getCombo(e) {
        const parts = [];
        if (e.ctrlKey) parts.push('ctrl');
        if (e.shiftKey) parts.push('shift');
        if (e.altKey) parts.push('alt');
        if (e.metaKey) parts.push('meta');

        let main = e.key;
        if (['Control', 'Shift', 'Alt', 'Meta'].includes(main)) {
            return parts.length ? parts.join('+') : main.toLowerCase();
        }

        if (/^F\d+$/.test(main)) main = main.toLowerCase();
        else if (main.length === 1) main = main.toLowerCase();
        else {
            const map = {
                ' ': 'space', 'Escape': 'escape', 'Tab': 'tab', 'Enter': 'enter',
                'ArrowUp': 'up', 'ArrowDown': 'down', 'ArrowLeft': 'left', 'ArrowRight': 'right',
                'Backspace': 'backspace', 'Delete': 'delete'
            };
            main = map[main] || main.toLowerCase();
        }

        return parts.length ? parts.join('+') + '+' + main : main;
    }
})();