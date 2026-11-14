(function() {
    class HijackExtension {
        constructor(runtime) {
            this.runtime = runtime;
            this.hijacked = new Set();
            // 记录已永久允许的按键，不再弹提示
            this.permanentlyAllowed = new Set();
            // 监听按键功能
            this.listening = false;
            this.lastPressedKey = '';
            this.onKeyListen = null;

            this.handler = (e) => {
                const combo = this.getCombo(e);
                const simple = this.getSimple(e);
                const hasMod = e.ctrlKey || e.shiftKey || e.altKey || e.metaKey;

                // 监听模式：记录按键
                if (this.listening) {
                    // 优先记录组合键，如果没有修饰键则记录简单键
                    const recorded = hasMod ? combo : simple;
                    this.lastPressedKey = recorded;
                    this.onKeyListen?.(recorded);
                }

                if (this.hijacked.has(combo) || (!hasMod && this.hijacked.has(simple))) {
                    e.preventDefault();
                    this.onKeyDown?.(combo);
                }
            };
            window.addEventListener('keydown', this.handler, true);
        }

        getSimple(e) {
            const k = e.key;
            if (/^F\d+$/.test(k)) return k.toUpperCase();
            if (k.length === 1) return k.toUpperCase();
            const map = { ' ': 'Space', 'Escape': 'Esc', 'Control': 'Ctrl', 'Shift': 'Shift', 'Alt': 'Alt', 'Meta': 'Meta', 'Tab': 'Tab', 'Enter': 'Enter', 'ArrowUp': 'Up', 'ArrowDown': 'Down', 'ArrowLeft': 'Left', 'ArrowRight': 'Right' };
            return map[k] || k;
        }

        getCombo(e) {
            const parts = [];
            if (e.ctrlKey) parts.push('Ctrl');
            if (e.shiftKey) parts.push('Shift');
            if (e.altKey) parts.push('Alt');
            if (e.metaKey) parts.push('Meta');
            let main = e.key;
            if (['Control', 'Shift', 'Alt', 'Meta'].includes(main)) {
                return parts.length ? parts.join('+') : main;
            }
            if (/^F\d+$/.test(main)) main = main.toUpperCase();
            else if (main.length === 1) main = main.toUpperCase();
            else {
                const map = { ' ': 'Space', 'Escape': 'Esc', 'Tab': 'Tab', 'Enter': 'Enter', 'ArrowUp': 'Up', 'ArrowDown': 'Down', 'ArrowLeft': 'Left', 'ArrowRight': 'Right', 'Backspace': 'Backspace', 'Delete': 'Delete' };
                main = map[main] || main;
            }
            return parts.length ? parts.join('+') + '+' + main : main;
        }

        getInfo() {
            return {
                id: 'hijackKeys',
                name: '按键劫持',
                color1: '#4c97ff',
                blocks: [
                    {
                        opcode: 'hijack',
                        blockType: 'command',
                        text: '劫持 [KEY] 按键',
                        arguments: { KEY: { type: 'string', menu: 'keyMenu', defaultValue: 'F12' } }
                    },
                    {
                        opcode: 'unhijack',
                        blockType: 'command',
                        text: '取消劫持 [KEY] 按键',
                        arguments: { KEY: { type: 'string', menu: 'keyMenu', defaultValue: 'F12' } }
                    },
                    {
                        opcode: 'resetPermission',
                        blockType: 'command',
                        text: '重新询问 [KEY] 的永久授权',
                        arguments: { KEY: { type: 'string', menu: 'keyMenu', defaultValue: 'F12' } }
                    },
                    {
                        opcode: 'isAuthorized',
                        blockType: 'Boolean',
                        text: '[KEY] 已授权?',
                        arguments: { KEY: { type: 'string', menu: 'keyMenu', defaultValue: 'F12' } }
                    },
                    {
                        opcode: 'isHijacking',
                        blockType: 'Boolean',
                        text: '[KEY] 正在劫持?',
                        arguments: { KEY: { type: 'string', menu: 'keyMenu', defaultValue: 'F12' } }
                    },
                    {
                        opcode: 'startListen',
                        blockType: 'command',
                        text: '开始监听按键'
                    },
                    {
                        opcode: 'stopListen',
                        blockType: 'command',
                        text: '停止监听按键'
                    },
                    {
                        opcode: 'getLastKey',
                        blockType: 'reporter',
                        text: '最后监听到的按键'
                    },
                    {
                        opcode: 'isListening',
                        blockType: 'Boolean',
                        text: '正在监听?'
                    }
                ],
                menus: {
                    keyMenu: {
                        acceptReporters: true,
                        items: ['F12', 'F11', 'F5', 'Ctrl+Shift+I', 'Ctrl+Shift+J', 'Ctrl+U', 'Ctrl+S', 'Alt', 'Tab', 'Esc', 'Space']
                    }
                }
            };
        }

        // 劫持：加安全确认
        hijack(args) {
            const key = args.KEY;

            // 已劫持直接返回
            if (this.hijacked.has(key)) return;

            // 已经永久允许的，直接劫持
            if (this.permanentlyAllowed.has(key)) {
                this.hijacked.add(key);
                return;
            }

            // 第一次劫持：弹浏览器确认
            const allow = window.confirm(
                `⚠️ 安全提示 \n\n` +
                `即将劫持按键「${key}」，这会阻止浏览器默认行为。这可能会用于搭配其他拓展进行恶意操作\n` +
                `（例如 F12 将无法打开开发者工具）\n\n` +
                `点击「确定」允许本次劫持\n` +
                `点击「取消」放弃劫持`
            );
            if (!allow) return;

            // 询问是否永久允许
            const permanent = window.confirm(
                `是否永久允许劫持「${key}」？\n\n` +
                `点击「确定」：永久允许，之后不再提示（请三思，除非缓存消失或项目主动要求重新选择授权，无法修改！）\n` +
                `点击「取消」：仅本次允许，下次仍会提示`
            );
            if (permanent) {
                this.permanentlyAllowed.add(key);
            }

            this.hijacked.add(key);
        }

        // 取消劫持：不弹提示
        unhijack(args) {
            this.hijacked.delete(args.KEY);
        }

        // 清除永久授权，下次劫持会重新弹窗询问
        resetPermission(args) {
            const key = args.KEY;
            const had = this.permanentlyAllowed.has(key);
            this.permanentlyAllowed.delete(key);
            // 顺便也取消当前劫持，让它回到未劫持状态，下次重新走流程
            this.hijacked.delete(key);

            if (had) {
                window.alert(`已清除「${key}」的永久授权\n下次劫持时会重新询问`);
            } else {
                window.alert(`「${key}」当前没有永久授权`);
            }
        }

        // 是否已授权（永久允许 或 已劫持）→ true / false
        isAuthorized(args) {
            const key = args.KEY;
            return this.permanentlyAllowed.has(key) || this.hijacked.has(key);
        }

        // 当前是否在劫持中 → true / false
        isHijacking(args) {
            return this.hijacked.has(args.KEY);
        }

        // 开始监听按键
        startListen() {
            this.listening = true;
            this.lastPressedKey = '';
        }

        // 停止监听按键
        stopListen() {
            this.listening = false;
        }

        // 获取最后监听到的按键
        getLastKey() {
            return this.lastPressedKey;
        }

        // 是否正在监听
        isListening() {
            return this.listening;
        }
    }

    if (typeof Scratch !== 'undefined' && Scratch.extensions) {
        Scratch.extensions.register(new HijackExtension());
    } else {
        window.HijackExtension = HijackExtension;
    }
})();