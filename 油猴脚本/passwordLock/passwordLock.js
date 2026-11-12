(function (Scratch) {
    'use strict';

    if (!Scratch.extensions.unsandboxed) {
        throw new Error('此扩展必须在非沙箱模式下运行');
    }

    const TARGET_PASSWORD = '20091226';
    const AUTHOR_NAME = '琪露诺キルノ';
    const QQ_GROUP = '957738643';

    let storedPassword = null;
    let overlayMounted = false;
    let projectLoadListener = null;
    let initialized = false;

    // 检测是否运行在打包后的 HTML 环境（打包后不启用防护）
    function isPackedHtml() {
        // TurboWarp 打包后通常会有特定的全局变量或标识
        // 这里用几种常见判断方式组合
        if (typeof window !== 'undefined') {
            // TurboWarp 打包后 window 上会有特定标记
            if (window.__tw_packaged__ || window.__TURBOWARP_PACKAGED__) return true;
            // 打包后通常没有 Scratch.vm 的编辑器扩展管理，但仍有 vm
            // 更可靠的方式：检查是否由 file:// 或独立 html 加载
            if (window.location && window.location.protocol === 'file:') return true;
        }
        return false;
    }

    function createOverlay() {
        if (document.getElementById('tw-password-overlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'tw-password-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0, 0, 0, 0.95);
            z-index: 2147483647;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: white;
            font-family: sans-serif;
            pointer-events: all;
            touch-action: none;
            user-select: none;
        `;

        const title = document.createElement('h2');
        title.textContent = '作品已锁定';
        title.style.marginBottom = '20px';

        const input = document.createElement('input');
        input.type = 'password';
        input.id = 'tw-password-input';
        input.placeholder = '请输入密码';
        input.style.cssText = `
            padding: 10px;
            font-size: 18px;
            border-radius: 5px;
            border: 1px solid #ccc;
            margin-bottom: 15px;
            width: 250px;
            text-align: center;
        `;

        const btn = document.createElement('button');
        btn.textContent = '解锁';
        btn.style.cssText = `
            padding: 10px 30px;
            font-size: 18px;
            cursor: pointer;
            border-radius: 5px;
            border: none;
            background: #4CAF50;
            color: white;
        `;

        const errorMsg = document.createElement('p');
        errorMsg.id = 'tw-password-error';
        errorMsg.style.cssText = `
            color: #ff5555;
            margin-top: 15px;
            text-align: center;
            line-height: 1.6;
        `;
        errorMsg.textContent = '';

        const tryUnlock = () => {
            const inputVal = input.value.trim();
            const expected = storedPassword || TARGET_PASSWORD;
            if (inputVal === expected) {
                overlay.remove();
                overlayMounted = false;
                if (projectLoadListener) {
                    Scratch.vm.off('PROJECT_RUN_START', projectLoadListener);
                    projectLoadListener = null;
                }
            } else {
                errorMsg.innerHTML = '';
                const line1 = document.createElement('div');
                line1.textContent = '密码错误！';
                const line2 = document.createElement('div');
                line2.textContent = `原作者（Bilibili）：${AUTHOR_NAME}`;
                const line3 = document.createElement('div');
                line3.textContent = `QQ群：${QQ_GROUP}`;
                errorMsg.appendChild(line1);
                errorMsg.appendChild(line2);
                errorMsg.appendChild(line3);
                input.value = '';
            }
        };

        btn.addEventListener('click', tryUnlock);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') tryUnlock();
        });

        overlay.appendChild(title);
        overlay.appendChild(input);
        overlay.appendChild(btn);
        overlay.appendChild(errorMsg);
        document.body.appendChild(overlay);
        overlayMounted = true;

        setTimeout(() => input.focus(), 100);
    }

    function scheduleLock() {
        // 打包成 HTML 后不启用
        if (isPackedHtml()) return;
        if (!storedPassword) return;

        // 等待项目加载完所有数据
        if (projectLoadListener) {
            Scratch.vm.off('PROJECT_RUN_START', projectLoadListener);
        }
        projectLoadListener = () => {
            // 延迟一小段，确保所有资源加载与界面渲染完成
            setTimeout(() => {
                createOverlay();
            }, 200);
        };
        Scratch.vm.on('PROJECT_RUN_START', projectLoadListener);
    }

    class PasswordLockExtension {
        getInfo() {
            return {
                id: 'passwordLock',
                name: '密码锁定',
                blocks: [
                    {
                        opcode: 'setPassword',
                        blockType: Scratch.BlockType.COMMAND,
                        text: '设置密码为 [PWD]',
                        arguments: {
                            PWD: {
                                type: Scratch.ArgumentType.STRING,
                                defaultValue: '20091226'
                            }
                        }
                    },
                    {
                        opcode: 'clearPassword',
                        blockType: Scratch.BlockType.COMMAND,
                        text: '清除密码'
                    }
                ]
            };
        }

        setPassword(args) {
            storedPassword = String(args.PWD);
            scheduleLock();
        }

        clearPassword() {
            storedPassword = null;
            if (projectLoadListener) {
                Scratch.vm.off('PROJECT_RUN_START', projectLoadListener);
                projectLoadListener = null;
            }
            const existing = document.getElementById('tw-password-overlay');
            if (existing) existing.remove();
            overlayMounted = false;
        }
    }

    Scratch.extensions.register(new PasswordLockExtension());
})(Scratch);