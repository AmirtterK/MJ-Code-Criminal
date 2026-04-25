import * as vscode from 'vscode';
import * as path from 'path';
import { spawn } from 'child_process';
import * as fs from 'fs';

const WIN = process.platform === 'win32';

interface Clip {
    label: string;
    text: string;
    audio: string | null;
}

const ERRORS: Clip[] = [
    { label: 'Hee Hee', text: 'Hee hee!', audio: 'hee-hee.mp3' },
    { label: 'Hoooo', text: 'Hooo...', audio: 'hoooo.mp3' },
    { label: 'Ow', text: 'Ow!', audio: 'aaow.mp3' },
    { label: 'Shamone', text: 'Shamone!', audio: 'shamo.mp3' },
    { label: 'Bad', text: "You know I'm bad — and so is your code.", audio: 'shamo.mp3' },
    { label: 'Smooth Criminal', text: 'As he came into the file... it was a code criminal.', audio: 'aaow.mp3' },
    { label: 'Billie Jean', text: 'Billie Jean is not my lover... but this error is yours.', audio: 'hee-hee.mp3' },
    { label: 'Beat It', text: 'Just beat it — fix it!', audio: 'hoooo.mp3' },
];

const SUCCESSES: Clip[] = [
    { label: 'PYT', text: 'P-Y-T, pretty young thing — clean build!', audio: null },
    { label: 'Wanna Be Startin', text: "Wanna be startin somethin... well, it compiled!", audio: null },
    { label: 'Rock With You', text: 'Rock with you... all night — build passed!', audio: null },
    { label: 'Earth Song', text: 'The earth sings... your build is green.', audio: null },
    { label: 'Heal the World', text: 'Heal the world — zero errors!', audio: null },
];

let statusBar: vscode.StatusBarItem;
let diagTimer: NodeJS.Timeout | null = null;
let lastUris = new Set<string>();
let lastScream = 0;
let activeProc: any = null;

function q(v: string) {
    return v.replace(/'/g, "''");
}

function run(s: string) {
    spawn("powershell", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", s], { stdio: 'ignore', windowsHide: true });
}

function play(p: string, v: number) {
    if (!WIN || !fs.existsSync(p)) return;
    if (activeProc) {
        try { activeProc.kill(); } catch (e) {}
    }
    const ps = `
    $c = @"
    using System;
    using System.Runtime.InteropServices;
    public class M {
        [DllImport("winmm.dll")]
        public static extern long mciSendString(string cmd, System.Text.StringBuilder rev, int len, IntPtr h);
    }
"@
    Add-Type -TypeDefinition $c
    $p = "${q(p)}"
    [M]::mciSendString("open \\"$p\\" type mpegvideo alias s", $null, 0, [IntPtr]::Zero)
    [M]::mciSendString("setaudio s volume to 1000", $null, 0, [IntPtr]::Zero)
    [M]::mciSendString("play s wait", $null, 0, [IntPtr]::Zero)
    [M]::mciSendString("close s", $null, 0, [IntPtr]::Zero)
    `;
    activeProc = spawn("powershell", ["-NoProfile", "-NonInteractive", "-Command", ps], { stdio: 'ignore', windowsHide: true });
    activeProc.on('exit', () => { activeProc = null; });
}

function scream(ctx: vscode.ExtensionContext, t: string, o?: Clip) {
    const now = Date.now();
    if (now - lastScream < 200 && !o) return;
    lastScream = now;

    const cfg = vscode.workspace.getConfiguration('mjCodeCriminal');
    if (!cfg.get('enabled')) return;

    let c: Clip;
    if (o) {
        c = o;
    } else if (t === 'error') {
        const r = Math.random();
        if (r < 0.25) c = ERRORS[0]; // Hee Hee
        else if (r < 0.50) c = ERRORS[1]; // Hoooo
        else if (r < 0.75) c = ERRORS[2]; // Ow
        else c = ERRORS[3 + Math.floor(Math.random() * 5)]; // Others (5% each)
    } else {
        c = SUCCESSES[Math.floor(Math.random() * SUCCESSES.length)];
    }

    const vol = cfg.get<number>('volume', 1.0);
    if (c.audio) play(path.join(ctx.extensionPath, 'audio', c.audio), vol);

    vscode.window.setStatusBarMessage(`MJ: ${c.text}`, 5000);
    if (statusBar) {
        statusBar.text = t === 'error' ? `$(error) MJ: ${c.label}` : `$(check) MJ: ${c.label}`;
    }
}

let extCtx: vscode.ExtensionContext;

function scan() {
    const cfg = vscode.workspace.getConfiguration('mjCodeCriminal');
    if (!cfg.get('enabled')) return;

    const cur = new Set<string>();
    let fresh = false;

    vscode.workspace.textDocuments.forEach(d => {
        vscode.languages.getDiagnostics(d.uri).forEach(x => {
            if (x.severity === vscode.DiagnosticSeverity.Error) {
                const k = `${d.uri.toString()}:${x.range.start.line}:${x.range.start.character}`;
                cur.add(k);
                if (!lastUris.has(k)) fresh = true;
            }
        });
    });

    if (fresh) {
        if (diagTimer) clearTimeout(diagTimer);
        diagTimer = setTimeout(() => { scream(extCtx, 'error'); diagTimer = null; }, 200);
    } else if (cur.size === 0 && lastUris.size > 0 && cfg.get('successSounds')) {
        scream(extCtx, 'success');
    }
    lastUris = cur;
}

let termBufs = new Map<any, string>();

async function monitor(ctx: vscode.ExtensionContext, exec: any) {
    try {
        for await (const chunk of exec.read()) {
            let b = (termBufs.get(exec) || '') + chunk;
            b = b.slice(-1000);
            termBufs.set(exec, b);

            const cln = b.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '').toLowerCase();
            const errs = ['error:', 'fatal', 'failed', 'npm err!', 'exit code 1', 'exception', 'uncaught', 'rejected', 'traceback', 'stack trace', 'cannot find symbol', 'compilation error'];
            
            if (errs.some(k => cln.includes(k))) {
                termBufs.delete(exec);
                scream(ctx, 'error');
                return; // Only scream once per execution
            }
        }
    } catch (e) {}
}

export function activate(ctx: vscode.ExtensionContext) {
    extCtx = ctx;
    statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBar.text = 'MJ Ready';
    statusBar.command = 'mj-code-criminal.toggle';
    statusBar.show();
    ctx.subscriptions.push(statusBar);

    // Pre-warm audio engine
    spawn("powershell", ["-NoProfile", "-NonInteractive", "-Command", "Add-Type -AssemblyName PresentationCore"], { stdio: 'ignore', windowsHide: true });

    ctx.subscriptions.push(vscode.languages.onDidChangeDiagnostics(scan));
    ctx.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(scan));
    ctx.subscriptions.push(vscode.workspace.onDidChangeTextDocument(e => {
        if (e.contentChanges.length > 0) scan();
    }));

    if (typeof (vscode.window as any).onDidStartTerminalShellExecution === 'function') {
        ctx.subscriptions.push((vscode.window as any).onDidStartTerminalShellExecution((e: any) => {
            monitor(ctx, e.execution);
        }));

        ctx.subscriptions.push((vscode.window as any).onDidEndTerminalShellExecution((e: any) => {
            termBufs.delete(e.execution);
            const cfg = vscode.workspace.getConfiguration('mjCodeCriminal');
            if (e.exitCode !== undefined && e.exitCode !== 0 && cfg.get('enabled')) {
                scream(ctx, 'error');
            } else if (e.exitCode === 0 && cfg.get('enabled') && cfg.get('successSounds')) {
                scream(ctx, 'success');
            }
        }));
    }

    ctx.subscriptions.push(
        vscode.commands.registerCommand('mj-code-criminal.testError', () => scream(ctx, 'error')),
        vscode.commands.registerCommand('mj-code-criminal.testSuccess', () => scream(ctx, 'success')),
        vscode.commands.registerCommand('mj-code-criminal.toggle', () => {
            const cfg = vscode.workspace.getConfiguration('mjCodeCriminal');
            const now = cfg.get('enabled');
            cfg.update('enabled', !now, vscode.ConfigurationTarget.Global);
            statusBar.text = !now ? 'MJ Active' : 'MJ Off';
        })
    );
    
    scan(); // Initial scan
}

export function deactivate() {}
