"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const WIN = process.platform === 'win32';
const ERRORS = [
    { label: 'Hee Hee', text: 'Hee hee!', audio: 'hee-hee.mp3' },
    { label: 'Hoooo', text: 'Hooo...', audio: 'hoooo.mp3' },
    { label: 'Ow', text: 'Ow!', audio: 'aaow.mp3' },
    { label: 'Shamone', text: 'Shamone!', audio: 'shamo.mp3' },
    { label: 'Bad', text: "You know I'm bad — and so is your code.", audio: 'shamo.mp3' },
    { label: 'Smooth Criminal', text: 'As he came into the file... it was a code criminal.', audio: 'aaow.mp3' },
    { label: 'Billie Jean', text: 'Billie Jean is not my lover... but this error is yours.', audio: 'hee-hee.mp3' },
    { label: 'Beat It', text: 'Just beat it — fix it!', audio: 'hoooo.mp3' },
];
const SUCCESSES = [
    { label: 'PYT', text: 'P-Y-T, pretty young thing — clean build!', audio: null },
    { label: 'Wanna Be Startin', text: "Wanna be startin somethin... well, it compiled!", audio: null },
    { label: 'Rock With You', text: 'Rock with you... all night — build passed!', audio: null },
    { label: 'Earth Song', text: 'The earth sings... your build is green.', audio: null },
    { label: 'Heal the World', text: 'Heal the world — zero errors!', audio: null },
];
let statusBar;
let diagTimer = null;
let lastUris = new Set();
let lastScream = 0;
let activeProc = null;
function q(v) {
    return v.replace(/'/g, "''");
}
function run(s) {
    (0, child_process_1.spawn)("powershell", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", s], { stdio: 'ignore', windowsHide: true });
}
function play(p, v) {
    if (!WIN || !fs.existsSync(p))
        return;
    if (activeProc) {
        try {
            activeProc.kill();
        }
        catch (e) { }
    }
    const vol = Math.max(0, Math.min(1, v)).toFixed(2);
    const ps = `Add-Type -AssemblyName PresentationCore;$m=New-Object System.Windows.Media.MediaPlayer;$m.Volume=${vol};$m.Open([Uri]::new('${q(p)}'));$m.Play();$d=(Get-Date).AddMilliseconds(100);while(-not $m.NaturalDuration.HasTimeSpan -and (Get-Date) -lt $d){Start-Sleep -Milliseconds 10};$w=2000;if($m.NaturalDuration.HasTimeSpan){$w=[Math]::Min(12000,[Math]::Max(200,[int]([Math]::Ceiling($m.NaturalDuration.TimeSpan.TotalMilliseconds)+500)))};Start-Sleep -Milliseconds $w;$m.Stop();$m.Close();`;
    activeProc = (0, child_process_1.spawn)("powershell", ["-NoProfile", "-NonInteractive", "-STA", "-ExecutionPolicy", "Bypass", "-Command", ps], { stdio: 'ignore', windowsHide: true });
    activeProc.on('exit', () => { activeProc = null; });
}
function scream(ctx, t, o) {
    const now = Date.now();
    if (now - lastScream < 200 && !o)
        return;
    lastScream = now;
    const cfg = vscode.workspace.getConfiguration('mjCodeCriminal');
    if (!cfg.get('enabled'))
        return;
    let c;
    if (o) {
        c = o;
    }
    else if (t === 'error') {
        const r = Math.random();
        if (r < 0.25)
            c = ERRORS[0]; // Hee Hee
        else if (r < 0.50)
            c = ERRORS[1]; // Hoooo
        else if (r < 0.75)
            c = ERRORS[2]; // Ow
        else
            c = ERRORS[3 + Math.floor(Math.random() * 5)]; // Others (5% each)
    }
    else {
        c = SUCCESSES[Math.floor(Math.random() * SUCCESSES.length)];
    }
    const vol = cfg.get('volume', 1.0);
    if (c.audio)
        play(path.join(ctx.extensionPath, 'audio', c.audio), vol);
    vscode.window.setStatusBarMessage(`MJ: ${c.text}`, 5000);
    if (statusBar) {
        statusBar.text = t === 'error' ? `$(error) MJ: ${c.label}` : `$(check) MJ: ${c.label}`;
    }
}
function monitor(ctx, exec) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, e_1, _b, _c;
        let played = false;
        try {
            try {
                for (var _d = true, _e = __asyncValues(exec.read()), _f; _f = yield _e.next(), _a = _f.done, !_a; _d = true) {
                    _c = _f.value;
                    _d = false;
                    const chunk = _c;
                    const cln = chunk.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '').toLowerCase();
                    const errs = ['error:', 'fatal error:', 'build failed', 'npm err!', 'exit code 1', 'failed'];
                    if (errs.some(k => cln.includes(k)) && !played) {
                        played = true;
                        scream(ctx, 'error');
                    }
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (!_d && !_a && (_b = _e.return)) yield _b.call(_e);
                }
                finally { if (e_1) throw e_1.error; }
            }
        }
        catch (e) { }
    });
}
function activate(ctx) {
    statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBar.text = 'MJ Ready';
    statusBar.command = 'mj-code-criminal.toggle';
    statusBar.show();
    ctx.subscriptions.push(statusBar);
    ctx.subscriptions.push(vscode.languages.onDidChangeDiagnostics(() => {
        const cfg = vscode.workspace.getConfiguration('mjCodeCriminal');
        if (!cfg.get('enabled'))
            return;
        const cur = new Set();
        let fresh = false;
        vscode.workspace.textDocuments.forEach(d => {
            vscode.languages.getDiagnostics(d.uri).forEach(x => {
                if (x.severity === vscode.DiagnosticSeverity.Error) {
                    const k = `${d.uri.toString()}:${x.range.start.line}:${x.range.start.character}`;
                    cur.add(k);
                    if (!lastUris.has(k))
                        fresh = true;
                }
            });
        });
        if (fresh) {
            if (diagTimer)
                clearTimeout(diagTimer);
            diagTimer = setTimeout(() => { scream(ctx, 'error'); diagTimer = null; }, 200);
        }
        else if (cur.size === 0 && lastUris.size > 0 && cfg.get('successSounds')) {
            scream(ctx, 'success');
        }
        lastUris = cur;
    }));
    if (typeof vscode.window.onDidStartTerminalShellExecution === 'function') {
        ctx.subscriptions.push(vscode.window.onDidStartTerminalShellExecution((e) => {
            monitor(ctx, e.execution);
        }));
        ctx.subscriptions.push(vscode.window.onDidEndTerminalShellExecution((e) => {
            const cfg = vscode.workspace.getConfiguration('mjCodeCriminal');
            if (e.exitCode !== undefined && e.exitCode !== 0 && cfg.get('enabled')) {
                scream(ctx, 'error');
            }
            else if (e.exitCode === 0 && cfg.get('enabled') && cfg.get('successSounds')) {
                scream(ctx, 'success');
            }
        }));
    }
    ctx.subscriptions.push(vscode.commands.registerCommand('mj-code-criminal.testError', () => scream(ctx, 'error')), vscode.commands.registerCommand('mj-code-criminal.testSuccess', () => scream(ctx, 'success')), vscode.commands.registerCommand('mj-code-criminal.toggle', () => {
        const cfg = vscode.workspace.getConfiguration('mjCodeCriminal');
        const now = cfg.get('enabled');
        cfg.update('enabled', !now, vscode.ConfigurationTarget.Global);
        statusBar.text = !now ? 'MJ Active' : 'MJ Off';
    }));
}
function deactivate() { }
//# sourceMappingURL=extension.js.map