(function (p39) {
  "use strict";

  class C2 {
    getInfo() {
      const vO18 = {
        id: "projectLockingv2",
        name: "作品锁",
        color1: "#4B0000",
        color2: "#4B0000",
        blockIconURI: "",
        menuIconURI: "",
        blocks: [{
          opcode: "setProjectPassword",
          blockType: p39.BlockType.COMMAND,
          text: "设置作品密码为 [PASSWORD] 使用密钥 [KEY]",
          arguments: {
            PASSWORD: {
              type: p39.ArgumentType.STRING,
              defaultValue: "123456"
            },
            KEY: {
              type: p39.ArgumentType.STRING,
              defaultValue: "mySecretKey"
            }
          }
        }, {
          opcode: "getCurrentPassword",
          blockType: p39.BlockType.REPORTER,
          text: "当前作品密码"
        }, {
          opcode: "encryptProjectPassword",
          blockType: p39.BlockType.REPORTER,
          text: "使用密钥 [KEY] 对 [TEXT] 进行加密",
          arguments: {
            KEY: {
              type: p39.ArgumentType.STRING,
              defaultValue: "mySecretKey"
            },
            TEXT: {
              type: p39.ArgumentType.STRING,
              defaultValue: "Hello World"
            }
          }
        }, "---", {
          opcode: "setLockTitle",
          blockType: p39.BlockType.COMMAND,
          text: "设置锁屏标题为 [TITLE]",
          arguments: {
            TITLE: {
              type: p39.ArgumentType.STRING,
              defaultValue: "请输入作品密码"
            }
          }
        }, {
          opcode: "setPasswordHint",
          blockType: p39.BlockType.COMMAND,
          text: "设置密码提示为 [HINT]",
          arguments: {
            HINT: {
              type: p39.ArgumentType.STRING,
              defaultValue: "请输入6位数字密码"
            }
          }
        }, {
          opcode: "setWelcomeText",
          blockType: p39.BlockType.COMMAND,
          text: "设置欢迎文本为 [TEXT]",
          arguments: {
            TEXT: {
              type: p39.ArgumentType.STRING,
              defaultValue: "欢迎使用本作品"
            }
          }
        }, {
          opcode: "setRedirectLink",
          blockType: p39.BlockType.COMMAND,
          text: "设置跳转链接 [URL] 显示文本 [TEXT]",
          arguments: {
            URL: {
              type: p39.ArgumentType.STRING,
              defaultValue: "https://example.com"
            },
            TEXT: {
              type: p39.ArgumentType.STRING,
              defaultValue: "访问我们的网站"
            }
          }
        }, {
          opcode: "setCustomStyle",
          blockType: p39.BlockType.COMMAND,
          text: "设置主题颜色 [COLOR] 背景图 [BG_URL]",
          arguments: {
            COLOR: {
              type: p39.ArgumentType.COLOR,
              defaultValue: "#0078D7"
            },
            BG_URL: {
              type: p39.ArgumentType.STRING,
              defaultValue: ""
            }
          }
        }, "---", {
          opcode: "enablePasswordProtection",
          blockType: p39.BlockType.COMMAND,
          text: "启用作品密码保护"
        }, {
          opcode: "disablePasswordProtection",
          blockType: p39.BlockType.COMMAND,
          text: "关闭作品密码保护"
        }, {
          opcode: "enableForPackaged",
          blockType: p39.BlockType.COMMAND,
          text: "设置打包作品也显示密码"
        }, {
          opcode: "disableForPackaged",
          blockType: p39.BlockType.COMMAND,
          text: "设置打包作品不显示密码"
        }, {
          opcode: "isPackagedProject",
          blockType: p39.BlockType.BOOLEAN,
          text: "当前是否为打包作品？"
        }, {
          opcode: "showPasswordScreen",
          blockType: p39.BlockType.COMMAND,
          text: "立即显示密码锁屏"
        }, {
          opcode: "hidePasswordScreen",
          blockType: p39.BlockType.COMMAND,
          text: "隐藏密码锁屏"
        }, "---", {
          opcode: "getLockTitle",
          blockType: p39.BlockType.REPORTER,
          text: "当前锁屏标题"
        }, {
          opcode: "getPasswordHint",
          blockType: p39.BlockType.REPORTER,
          text: "当前密码提示"
        }, {
          opcode: "isPasswordProtected",
          blockType: p39.BlockType.BOOLEAN,
          text: "作品是否受密码保护？"
        }]
      };
      return vO18;
    }
    constructor() {
      this.passwordEnabled = false;
      this.encryptedPayloadShards = [];
      this.encryptionKeyRaw = "";
      this.lockTitle = "请输入作品密码";
      this.passwordHint = "请输入密码";
      this.welcomeText = "";
      this.redirectUrl = "";
      this.redirectText = "";
      this.themeColor = "#0078D7";
      this.backgroundImage = "";
      this.forceShowInPackaged = false;
      this.iframeOverlay = null;
      this.observer = null;
      this.devtoolsTimer = null;
      this.VAR_SLOTS = ["_d1", "_d2", "_d3", "_d4", "_d5", "_d6"];
      try {
        p39.vm.runtime.on("PROJECT_LOADED", () => this.handleProjectLoad());
      } catch (e19) {} // TOLOOK
      setTimeout(() => this.handleProjectLoad(), 0);
    }
    async deriveKeyFromPassword(p40, p41, p42 = 150000) {
      const v63 = new TextEncoder();
      const v64 = await crypto.subtle.importKey("raw", v63.encode(p40), {
        name: "PBKDF2"
      }, false, ["deriveKey"]);
      const vO19 = {
        name: "PBKDF2",
        salt: p41,
        iterations: p42,
        hash: "SHA-256"
      };
      const vO20 = {
        name: "AES-GCM",
        length: 256
      };
      const v65 = await crypto.subtle.deriveKey(vO19, v64, vO20, true, ["encrypt", "decrypt"]);
      return v65;
    }
    ab2b64(p43) {
      return btoa(String.fromCharCode.apply(null, new Uint8Array(p43)));
    }
    b642ab(p44) {
      const vAtob2 = atob(p44);
      const v66 = new Uint8Array(vAtob2.length);
      for (let vLN07 = 0; vLN07 < vAtob2.length; vLN07++) {
        v66[vLN07] = vAtob2.charCodeAt(vLN07);
      }
      return v66.buffer;
    }
    randBytes(p45 = 16) {
      const v67 = new Uint8Array(p45);
      crypto.getRandomValues(v67);
      return v67.buffer;
    }
    async encryptPayloadJSON(p46, p47) {
      const v68 = new TextEncoder();
      const v69 = this.randBytes(16);
      const v70 = this.randBytes(12);
      const v71 = await this.deriveKeyFromPassword(p47, v69, 150000);
      const v72 = v68.encode(JSON.stringify(p46));
      const vO21 = {
        name: "AES-GCM",
        iv: v70
      };
      const v73 = await crypto.subtle.encrypt(vO21, v71, v72);
      const v74 = new Uint8Array(v70);
      const v75 = new Uint8Array(v73);
      const v76 = new Uint8Array(v74.length + v75.length);
      v76.set(v74, 0);
      v76.set(v75, v74.length);
      const v77 = v76.length;
      const v78 = this.VAR_SLOTS.length;
      const v79 = Math.ceil(v77 / v78);
      const vA5 = [];
      for (let vLN08 = 0; vLN08 < v78; vLN08++) {
        const v80 = vLN08 * v79;
        const v81 = Math.min(v80 + v79, v77);
        const v82 = v76.slice(v80, v81);
        const vO22 = {
          idx: vLN08,
          partB64: this.ab2b64(v82.buffer)
        };
        const vO23 = {
          p: vO22.partB64,
          k: this.ab2b64(v69),
          i: vO22.idx,
          r: Math.floor(Math.random() * 1000000000)
        };
        vA5.push(btoa(unescape(encodeURIComponent(JSON.stringify(vO23)))));
      }
      const vO24 = {
        length: v78
      };
      const v83 = Array.from(vO24, (p48, p49) => p49).sort(() => Math.random() - 0.5);
      const v84 = v83.map(p50 => vA5[p50]);
      return {
        shards: v84,
        meta: {
          shardCount: v78,
          saltB64: this.ab2b64(v69),
          iterations: 150000
        }
      };
    }
    async decryptShardsFromVars(p51) {
      try {
        const vA6 = [];
        for (let v85 of this.VAR_SLOTS) {
          const v86 = this.getVariable(v85);
          if (v86) {
            vA6.push(String(v86));
          }
        }
        if (vA6.length === 0) {
          return null;
        }
        const vA7 = [];
        for (let v87 of vA6) {
          try {
            const vDecodeURIComponent2 = decodeURIComponent(escape(atob(v87)));
            const v88 = JSON.parse(vDecodeURIComponent2);
            vA7.push(v88);
          } catch (e20) {}
        }
        if (vA7.length === 0) {
          return null;
        }
        vA7.sort((p52, p53) => p52.i - p53.i);
        const v89 = vA7.map(p54 => this.b642ab(p54.p));
        let vLN09 = 0;
        for (let v90 of v89) {
          vLN09 += v90.byteLength;
        }
        const v91 = new Uint8Array(vLN09);
        let vLN010 = 0;
        for (let v92 of v89) {
          v91.set(new Uint8Array(v92), vLN010);
          vLN010 += v92.byteLength;
        }
        const v93 = v91.slice(0, 12).buffer;
        const v94 = v91.slice(12).buffer;
        const v95 = this.b642ab(vA7[0].k);
        const v96 = await this.deriveKeyFromPassword(p51, v95, vA7[0].iterations || 150000);
        const vO25 = {
          name: "AES-GCM",
          iv: v93
        };
        const v97 = await crypto.subtle.decrypt(vO25, v96, v94);
        const v98 = new TextDecoder().decode(v97);
        return JSON.parse(v98);
      } catch (e21) {
        return null;
      }
    }
    setShardsToVars(p55) {
      for (let vLN011 = 0; vLN011 < this.VAR_SLOTS.length; vLN011++) {
        const v99 = this.VAR_SLOTS[vLN011];
        const v100 = p55[vLN011] || "";
        this.setVariable(v99, v100);
      }
    }
    clearShardVars() {
      for (let v101 of this.VAR_SLOTS) {
        this.setVariable(v101, "");
      }
    }
    async setProjectPassword(p56) {
      const vString5 = String(p56.PASSWORD || "");
      const vString6 = String(p56.KEY || "");
      if (!vString5 || !vString6) {
        return;
      }
      const vO26 = {
        pw: vString5,
        createdAt: Date.now(),
        metaNote: "projectLockingV2-enc"
      };
      try {
        const {
          shards: _0x1e45b7
        } = await this.encryptPayloadJSON(vO26, vString6);
        this.setShardsToVars(_0x1e45b7);
        this.encryptionKeyRaw = vString6;
        this.passwordEnabled = true;
        console.log("[作品锁] 密码已设置（高级加密 + 分片存储）");
      } catch (e22) {
        console.error("[作品锁] 加密保存失败", e22);
      }
    }
    async getCurrentPassword() {
      if (!this.encryptionKeyRaw) {
        return "密码未设置或不可用（请在运行时设置密钥）";
      }
      const v102 = await this.decryptShardsFromVars(this.encryptionKeyRaw);
      if (v102 && v102.pw) {
        return v102.pw;
      }
      return "密码不可读取或密钥错误";
    }
    async encryptProjectPassword(p57) {
      const vString7 = String(p57.TEXT || "");
      const vString8 = String(p57.KEY || "");
      if (!vString7 || !vString8) {
        return "";
      }
      try {
        const vO27 = {
          t: vString7,
          ts: Date.now()
        };
        const {
          shards: _0x368e53
        } = await this.encryptPayloadJSON(vO27, vString8);
        return _0x368e53.join("|");
      } catch (e23) {
        return "";
      }
    }
    setLockTitle(p58) {
      this.lockTitle = String(p58.TITLE || "请输入作品密码");
    }
    setPasswordHint(p59) {
      this.passwordHint = String(p59.HINT || "请输入密码");
    }
    setWelcomeText(p60) {
      this.welcomeText = String(p60.TEXT || "");
    }
    setRedirectLink(p61) {
      this.redirectUrl = String(p61.URL || "");
      this.redirectText = String(p61.TEXT || "");
    }
    setCustomStyle(p62) {
      this.themeColor = String(p62.COLOR || "#0078D7");
      this.backgroundImage = String(p62.BG_URL || "");
    }
    enablePasswordProtection() {
      this.passwordEnabled = true;
    }
    disablePasswordProtection() {
      this.passwordEnabled = false;
      this.hidePasswordScreen();
    }
    enableForPackaged() {
      this.forceShowInPackaged = true;
    }
    disableForPackaged() {
      this.forceShowInPackaged = false;
    }
    isPackagedProject() {
      return typeof scaffolding !== "undefined";
    }
    async isPasswordProtected() {
      return !!this.passwordEnabled && (await this.decryptShardsFromVars(this.encryptionKeyRaw)) !== null;
    }
    showPasswordScreen() {
      if (this.isPackagedProject() && !this.forceShowInPackaged) {
        return;
      }
      if (this.passwordEnabled) {
        this.createIframePasswordScreen();
      }
    }
    hidePasswordScreen() {
      this.removeEventListeners();
      this.removeIframe();
    }
    setVariable(p63, p64) {
      try {
        const v103 = p39.vm.runtime;
        const v104 = v103.getTargetForStage();
        let v105 = v104.lookupVariableByNameAndType(p63, "");
        if (!v105) {
          v103.createNewGlobalVariable(p63, "");
          v105 = v104.lookupVariableByNameAndType(p63, "");
        }
        if (v105) {
          v105.value = p64;
        }
      } catch (e24) {}
    }
    getVariable(p65) {
      try {
        const v106 = p39.vm.runtime;
        const v107 = v106.getTargetForStage().lookupVariableByNameAndType(p65, "");
        if (v107) {
          return v107.value;
        } else {
          return null;
        }
      } catch (e25) {
        return null;
      }
    }
    createIframePasswordScreen() {
      this.removeIframe();
      const v108 = document.createElement("iframe");
      v108.src = "about:blank";
      const vO28 = {
        position: "fixed",
        top: "0",
        left: "0",
        width: "100%",
        height: "100%",
        zIndex: "2147483647",
        border: "none",
        background: "rgba(0,0,0,0.8)"
      };
      Object.assign(v108.style, vO28);
      document.body.appendChild(v108);
      this.iframeOverlay = v108;
      const v109 = v108.contentDocument || v108.contentWindow.document;
      v109.open();
      v109.write("\n        <!doctype html><html><head><meta charset=\"utf-8\"><style>\n          body{margin:0;display:flex;align-items:center;justify-content:center;height:100vh;background:transparent;font-family:Microsoft YaHei}\n          .box{background:#fff;padding:28px;border-radius:12px;width:420px;box-shadow:0 10px 30px rgba(0,0,0,0.25);text-align:center}\n          h2{color:" + this.themeColor + ";margin:0 0 12px 0}\n          input{width:100%;padding:10px;border-radius:8px;border:1px solid #ddd;font-size:16px}\n          button{margin-top:12px;padding:10px 12px;border-radius:8px;border:none;background:" + this.themeColor + ";color:#fff;cursor:pointer;font-size:15px}\n        </style></head><body>\n          <div class=\"box\">\n            <h2>" + this.lockTitle + "</h2>\n            " + (this.welcomeText ? "<div style=\"color:#666;margin-bottom:8px\">" + this.welcomeText + "</div>" : "") + "\n            <input id=\"p\" type=\"password\" placeholder=\"" + this.passwordHint + "\" autofocus/>\n            <button id=\"b\">确认解锁</button>\n            " + (this.redirectUrl ? "<div style=\"margin-top:10px\"><a href=\"" + this.redirectUrl + "\" target=\"_blank\">" + (this.redirectText || this.redirectUrl) + "</a></div>" : "") + "\n          </div>\n          <script>\n            const btn=document.getElementById('b'), ip=document.getElementById('p');\n            btn.onclick=()=>{ parent.postMessage({type:'VERIFY_PASSWORD', p: ip.value}, '*'); };\n            ip.addEventListener('keypress', e=>{ if(e.key==='Enter') btn.click(); });\n            window.addEventListener('message', (ev)=>{ if(!ev.data) return; if(ev.data.type==='PASSWORD_SUCCESS'){ document.body.innerHTML='<div style=\"font-size:20px;color:#28a745\">✓ 验证成功，正在解锁...</div>'; } else if(ev.data.type==='PASSWORD_ERROR'){ ip.value=''; ip.style.borderColor='#ff4757'; ip.classList.add('shake'); setTimeout(()=>ip.style.borderColor='',300); } });\n          </script>\n        </body></html>\n      ");
      v109.close();
      this.iframeListener = p66 => {
        if (!p66.data) {
          return;
        }
        if (p66.data.type === "VERIFY_PASSWORD") {
          this.verifyIframePwd(p66.data.p);
        }
      };
      window.addEventListener("message", this.iframeListener);
      this.preventEscapeAndTamper();
      this.startDevtoolsGuard();
    }
    async verifyIframePwd(p67) {
      try {
        let v110 = false;
        if (this.encryptionKeyRaw) {
          const v111 = await this.decryptShardsFromVars(this.encryptionKeyRaw);
          if (v111 && v111.pw === p67) {
            v110 = true;
          }
        }
        if (!v110) {
          const v112 = await this.decryptShardsFromVars(p67);
          if (v112 && v112.pw === p67) {
            v110 = true;
            this.encryptionKeyRaw = p67;
          }
        }
        if (v110) {
          if (this.iframeOverlay && this.iframeOverlay.contentWindow) {
            const vO29 = {
              type: "PASSWORD_SUCCESS"
            };
            this.iframeOverlay.contentWindow.postMessage(vO29, "*");
          } // TOLOOK
          setTimeout(() => {
            this.removeEventListeners();
            this.removeIframe();
          }, 800);
        } else if (this.iframeOverlay && this.iframeOverlay.contentWindow) {
          const vO30 = {
            type: "PASSWORD_ERROR"
          };
          this.iframeOverlay.contentWindow.postMessage(vO30, "*");
        }
      } catch (e26) {
        if (this.iframeOverlay && this.iframeOverlay.contentWindow) {
          const vO31 = {
            type: "PASSWORD_ERROR"
          };
          this.iframeOverlay.contentWindow.postMessage(vO31, "*");
        }
      }
    }
    removeIframe() {
      if (this.iframeOverlay) {
        try {
          this.iframeOverlay.remove();
        } catch (e27) {}
        this.iframeOverlay = null;
      }
      if (this.iframeListener) {
        window.removeEventListener("message", this.iframeListener);
        this.iframeListener = null;
      }
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }
      if (this.devtoolsTimer) {
        clearInterval(this.devtoolsTimer);
        this.devtoolsTimer = null;
      }
    }
    preventEscapeAndTamper() {
      this.kd = p68 => {
        if (p68.key === "F12" || p68.ctrlKey && p68.shiftKey && (p68.key === "I" || p68.key === "J" || p68.key === "C") || p68.ctrlKey && p68.key === "u") {
          p68.preventDefault();
          p68.stopPropagation();
        }
      };
      this.ctx = p69 => {
        p69.preventDefault();
      };
      this.sel = p70 => {
        p70.preventDefault();
      };
      document.addEventListener("keydown", this.kd, true);
      document.addEventListener("contextmenu", this.ctx, true);
      document.addEventListener("selectstart", this.sel, true);
      this.observer = new MutationObserver(p71 => {
        for (const v113 of p71) {
          const v114 = Array.from(v113.removedNodes || []);
          if (this.iframeOverlay && v114.includes(this.iframeOverlay)) {
            this.triggerSelfDestruct("检测到尝试移除锁屏，作品已自毁锁定");
            return;
          }
          if (v113.type === "attributes" && this.iframeOverlay && v113.target === this.iframeOverlay) {
            const v115 = window.getComputedStyle(this.iframeOverlay);
            if (this.iframeOverlay.hidden || v115.display === "none" || v115.visibility === "hidden" || parseFloat(v115.opacity || "1") === 0) {
              this.triggerSelfDestruct("检测到尝试隐藏锁屏，作品已自毁锁定");
              return;
            }
          }
        }
      });
      try {
        const vO32 = {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["style", "class", "hidden"]
        };
        this.observer.observe(document.body, vO32);
      } catch (e28) {}
    }
    removeEventListeners() {
      try {
        document.removeEventListener("keydown", this.kd, true);
        document.removeEventListener("contextmenu", this.ctx, true);
        document.removeEventListener("selectstart", this.sel, true);
      } catch (e29) {}
      if (this.observer) {
        try {
          this.observer.disconnect();
        } catch (e30) {}
        this.observer = null;
      }
    }
    async isDevtoolsOpen() {
      try {
        if (window.outerWidth - window.innerWidth > 160 || window.outerHeight - window.innerHeight > 160) {
          return true;
        }
        let v116 = false;
        const vO33 = {
          toString: function () {
            v116 = true;
            return "";
          }
        };
        console.log("%c", vO33);
        return v116;
      } catch (e31) {
        return false;
      }
    }
    startDevtoolsGuard() {
      if (this.devtoolsTimer) {
        clearInterval(this.devtoolsTimer);
      }
      this.devtoolsTimer = // TOLOOK
      setInterval(async () => {
        if (await this.isDevtoolsOpen()) {
          this.triggerSelfDestruct("检测到开发者工具，作品已自毁锁定");
        }
      }, 800);
    }
    async triggerSelfDestruct(p72) {
      try {
        console.warn("[作品锁] triggerSelfDestruct:", p72);
        this.clearShardVars();
        this.passwordEnabled = false;
        this.encryptedPayloadShards = [];
        this.encryptionKeyRaw = "";
        this.spawnStageWarning();
        this.showPermanentLockScreen(p72);
        try {
          console.log("=== CRACK LOG START ===");
          console.log("attempt_id:", Math.floor(Math.random() * 1000000000));
          console.log("trace:", "0xDEADBEEF", "0xBADF00D", "0xFEEDFACE");
          console.log("=== CRACK LOG END ===");
          const v117 = document.title;
          document.title = "破解失败 - 作品已锁"; // TOLOOK
          setTimeout(() => {
            document.title = v117;
          }, 3000);
        } catch (e32) {}
      } catch (e33) {
        console.error("[作品锁] 自毁过程出现异常", e33);
      }
    }
    spawnStageWarning() {
      try {
        const v118 = document.createElement("div");
        v118.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:21474836460;";
        document.body.appendChild(v118);
        const vA8 = ["#ff4757", "#ffa502", "#ff6b6b", "#70a1ff", "#2ed573"];
        for (let vLN012 = 0; vLN012 < 60; vLN012++) {
          const v119 = document.createElement("div");
          v119.textContent = "666 恭喜你破解失败，作品已锁";
          v119.style.cssText = "\n            position:absolute;\n            left:" + (Math.random() * 80 + 10) + "%;\n            top:" + (Math.random() * 80 + 10) + "%;\n            transform:translate(-50%,-50%) rotate(" + (Math.random() - 0.5) * 60 + "deg);\n            font-size:" + Math.floor(Math.random() * 28 + 16) + "px;\n            font-weight:800;\n            color:" + vA8[Math.floor(Math.random() * vA8.length)] + ";\n            text-shadow:0 2px 6px rgba(0,0,0,0.3);\n            opacity:0;\n            pointer-events:none;\n            transition:opacity 0.25s ease;\n          ";
          v118.appendChild(v119);
          (function (p73) {
            // TOLOOK
            setTimeout(() => {
              p73.style.opacity = "1";
            }, Math.random() * 400); // TOLOOK
            setInterval(() => {
              p73.style.opacity = p73.style.opacity === "1" ? "0.15" : "1";
            }, 600 + Math.random() * 800);
          })(v119);
        } // TOLOOK
        setTimeout(() => {
          try {
            v118.remove();
          } catch (e34) {}
        }, 25000);
      } catch (e35) {}
    }
    showPermanentLockScreen(p74) {
      this.removeIframe();
      const v120 = document.createElement("iframe");
      v120.src = "about:blank";
      const vO34 = {
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        zIndex: 21474836470,
        border: "none",
        background: "rgba(0,0,0,0.95)"
      };
      Object.assign(v120.style, vO34);
      document.body.appendChild(v120);
      this.iframeOverlay = v120;
      const v121 = v120.contentDocument || v120.contentWindow.document;
      v121.open();
      v121.write("\n        <!doctype html><html><head><meta charset=\"utf-8\"><style>\n        body{margin:0;display:flex;align-items:center;justify-content:center;height:100vh;background:#111;color:#fff;font-family:Microsoft YaHei}\n        .box{background:#fff;color:#111;padding:28px;border-radius:12px;width:520px;text-align:center}\n        h2{color:#ff4757;margin:0 0 10px 0}\n        p{color:#333}\n        </style></head><body>\n        <div class=\"box\"><h2>作品已锁定</h2><p>" + (p74 || "作品数据异常，已锁定") + "</p><p style=\"margin-top:12px;color:#e67e22\">⚠️ 请勿篡改作品数据，请联系作者获取帮助</p></div>\n        <script>\n          document.addEventListener('keydown', e=>{ e.preventDefault(); e.stopPropagation(); return false; });\n          document.addEventListener('contextmenu', e=>{ e.preventDefault(); return false; });\n        </script>\n        </body></html>\n      ");
      v121.close();
      this.preventAll();
    }
    preventAll() {
      this.blockAll = p75 => {
        p75.preventDefault();
        p75.stopPropagation();
        return false;
      };
      document.addEventListener("keydown", this.blockAll, true);
      document.addEventListener("keyup", this.blockAll, true);
      document.addEventListener("keypress", this.blockAll, true);
      document.addEventListener("mousedown", this.blockAll, true);
      document.addEventListener("mouseup", this.blockAll, true);
      document.addEventListener("click", this.blockAll, true);
      document.addEventListener("contextmenu", this.blockAll, true);
      window.addEventListener("beforeunload", p76 => {
        p76.preventDefault();
        p76.returnValue = "作品已锁定";
        return "作品已锁定";
      });
    }
    async handleProjectLoad() {
      let v122 = false;
      for (let v123 of this.VAR_SLOTS) {
        if (this.getVariable(v123)) {
          v122 = true;
          break;
        }
      }
      if (!v122) {
        return;
      }
      try {
        if (this.encryptionKeyRaw) {
          const v124 = await this.decryptShardsFromVars(this.encryptionKeyRaw);
          if (v124 && v124.pw) {
            this.passwordEnabled = true;
            console.log("[作品锁] 发现加密数据（会话密钥有效）");
            this.createIframePasswordScreen();
            return;
          }
        }
        this.passwordEnabled = true;
        this.createIframePasswordScreen();
      } catch (e36) {
        this.triggerSelfDestruct("系统错误，作品已自毁锁定");
      }
    }
  }
  p39.extensions.register(new C2());
})(Scratch);