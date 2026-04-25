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
    { label: 'Bad', text: "You know I'm bad - and so is your code.", audio: 'shamo.mp3' },
    { label: 'Smooth Criminal', text: 'As he came into the file... it was a code criminal.', audio: 'aaow.mp3' },
    { label: 'Billie Jean', text: 'Billie Jean is not my lover... but this error is yours.', audio: 'hee-hee.mp3' },
    { label: 'Beat It', text: 'Just beat it - fix it!', audio: 'hoooo.mp3' },
];

const SUCCESSES: Clip[] = [
    { label: 'PYT', text: 'P-Y-T, pretty young thing - clean build!', audio: null },
    { label: 'Wanna Be Startin', text: "Wanna be startin somethin... well, it compiled!", audio: null },
    { label: 'Rock With You', text: 'Rock with you... all night - build passed!', audio: null },
    { label: 'Earth Song', text: 'The earth sings... your build is green.', audio: null },
    { label: 'Heal the World', text: 'Heal the world - zero errors!', audio: null },
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
    const vol = Math.max(0, Math.min(1, v)).toFixed(2);
    const ps = `Add-Type -AssemblyName PresentationCore;$m=New-Object System.Windows.Media.MediaPlayer;$m.Volume=${vol};$m.Open([Uri]::new('${q(p)}'));$m.Play();$d=(Get-Date).AddMilliseconds(100);while(-not $m.NaturalDuration.HasTimeSpan -and (Get-Date) -lt $d){Start-Sleep -Milliseconds 10};$w=2000;if($m.NaturalDuration.HasTimeSpan){$w=[Math]::Min(12000,[Math]::Max(200,[int]([Math]::Ceiling($m.NaturalDuration.TimeSpan.TotalMilliseconds)+500)))};Start-Sleep -Milliseconds $w;$m.Stop();$m.Close();`;
    activeProc = spawn("powershell", ["-NoProfile", "-NonInteractive", "-Command", ps], { stdio: 'ignore', windowsHide: true });
    activeProc.on('exit', () => { activeProc = null; });
}

function scream(ctx: vscode.ExtensionContext, t: 'error' | 'warning' | 'success', o?: Clip) {
    const now = Date.now();
    if (now - lastScream < 200 && !o) return;
    lastScream = now;

    const cfg = vscode.workspace.getConfiguration('mjCodeCriminal');
    if (!cfg.get('enabled')) return;

    let c: Clip;
    if (o) {
        c = o;
    } else if (t === 'error') {
        c = ERRORS[1]; // Hoooo (Ohhhhhh)
    } else if (t === 'warning') {
        c = ERRORS[3]; // Shamone (Jam Ohn)
    } else {
        c = ERRORS[0]; // Hee Hee (Yee Hee)
    }

    const vol = cfg.get<number>('volume', 1.0);
    if (c.audio) play(path.join(ctx.extensionPath, 'audio', c.audio), vol);

    vscode.window.setStatusBarMessage(`MJ: ${c.text}`, 5000);
    if (statusBar) {
        if (t === 'error') statusBar.text = `$(error) MJ: ${c.label}`;
        else if (t === 'warning') statusBar.text = `$(warning) MJ: ${c.label}`;
        else statusBar.text = `$(check) MJ: ${c.label}`;
    }
}

let extCtx: vscode.ExtensionContext;
let lastWarns = new Set<string>();

function scan() {
    const cfg = vscode.workspace.getConfiguration('mjCodeCriminal');
    if (!cfg.get('enabled')) return;

    const curErrs = new Set<string>();
    const curWarns = new Set<string>();
    let freshErr = false;
    let freshWarn = false;

    vscode.workspace.textDocuments.forEach(d => {
        vscode.languages.getDiagnostics(d.uri).forEach(x => {
            const k = `${d.uri.toString()}:${x.range.start.line}:${x.range.start.character}`;
            if (x.severity === vscode.DiagnosticSeverity.Error) {
                curErrs.add(k);
                if (!lastUris.has(k)) freshErr = true;
            } else if (x.severity === vscode.DiagnosticSeverity.Warning) {
                curWarns.add(k);
                if (!lastWarns.has(k)) freshWarn = true;
            }
        });
    });

    if (freshErr) {
        if (diagTimer) clearTimeout(diagTimer);
        diagTimer = setTimeout(() => { scream(extCtx, 'error'); diagTimer = null; }, 200);
    } else if (freshWarn) {
        if (diagTimer) clearTimeout(diagTimer);
        diagTimer = setTimeout(() => { scream(extCtx, 'warning'); diagTimer = null; }, 200);
    } else if (curErrs.size === 0 && lastUris.size > 0 && cfg.get('successSounds')) {
        scream(extCtx, 'success');
    }

    lastUris = curErrs;
    lastWarns = curWarns;
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
            const warns = ['warning:', 'warn:', 'npm warn'];

            if (errs.some(k => cln.includes(k))) {
                termBufs.delete(exec);
                scream(ctx, 'error');
                return;
            }
            if (warns.some(k => cln.includes(k))) {
                termBufs.delete(exec);
                scream(ctx, 'warning');
                return;
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
        const startTimes = new Map<any, number>();

        ctx.subscriptions.push((vscode.window as any).onDidStartTerminalShellExecution((e: any) => {
            startTimes.set(e.execution, Date.now());
            monitor(ctx, e.execution);
        }));

        ctx.subscriptions.push((vscode.window as any).onDidEndTerminalShellExecution((e: any) => {
            const duration = Date.now() - (startTimes.get(e.execution) || 0);
            startTimes.delete(e.execution);
            termBufs.delete(e.execution);

            const cfg = vscode.workspace.getConfiguration('mjCodeCriminal');
            if (!cfg.get('enabled')) return;

            if (e.exitCode !== undefined && e.exitCode !== 0) {
                scream(ctx, 'error');
            } else if (e.exitCode === 0 && cfg.get('successSounds')) {
                const cmd = (e.execution.commandLine?.value || '').toLowerCase();
                const buildCmds = ['java', 'javac', 'npm', 'node', 'python', 'gcc', 'g++', 'cargo', 'go', 'make', 'cmake', 'dotnet'];
                const isBuild = buildCmds.some(k => cmd.includes(k));
                
                if (isBuild || duration > 1000) {
                    scream(ctx, 'success');
                }
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
