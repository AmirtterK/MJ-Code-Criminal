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
    { label: 'Shamone', text: 'Shamone!', audio: 'shamo.mp3' },
    { label: 'Ow', text: 'Ow!', audio: 'aaow.mp3' },
    { label: 'Hee Hee', text: 'Hee hee!', audio: 'hee-hee.mp3' },
    { label: 'Hoooo', text: 'Hooo...', audio: 'hoooo.mp3' },
    { label: 'Bad', text: "You know I'm bad — and so is your code.", audio: 'shamo.mp3' },
    { label: 'Smooth Criminal', text: 'As he came into the file... errors everywhere.', audio: 'aaow.mp3' },
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
let errorTimer: NodeJS.Timeout | null = null;
let lastUris = new Set<string>();
let termBuf = '';
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
    activeProc = spawn("powershell", ["-NoProfile", "-NonInteractive", "-STA", "-ExecutionPolicy", "Bypass", "-Command", ps], { stdio: 'ignore', windowsHide: true });
    activeProc.on('exit', () => { activeProc = null; });
}

function scream(ctx: vscode.ExtensionContext, t: string, o?: Clip) {
    const now = Date.now();
    if (now - lastScream < 1500 && !o) return;
    lastScream = now;

    const cfg = vscode.workspace.getConfiguration('mjCodeCriminal');
    if (!cfg.get('enabled')) return;

    const c = o || (t === 'error' ? ERRORS[Math.floor(Math.random() * ERRORS.length)] : SUCCESSES[Math.floor(Math.random() * SUCCESSES.length)]);
    const vol = cfg.get<number>('volume', 1.0);

    if (c.audio) play(path.join(ctx.extensionPath, 'audio', c.audio), vol);

    vscode.window.setStatusBarMessage(`MJ: ${c.text}`, 5000);
    if (statusBar) {
        statusBar.text = t === 'error' ? `$(error) MJ: ${c.label}` : `$(check) MJ: ${c.label}`;
    }
}

export function activate(ctx: vscode.ExtensionContext) {
    statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBar.text = 'MJ Ready';
    statusBar.command = 'mj-code-criminal.toggle';
    statusBar.show();
    ctx.subscriptions.push(statusBar);

    ctx.subscriptions.push(vscode.languages.onDidChangeDiagnostics(() => {
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
            if (errorTimer) clearTimeout(errorTimer);
            errorTimer = setTimeout(() => { scream(ctx, 'error'); errorTimer = null; }, 1200);
        } else if (cur.size === 0 && lastUris.size > 0 && cfg.get('successSounds')) {
            scream(ctx, 'success');
        }
        lastUris = cur;
    }));

    if (typeof (vscode.window as any).onDidWriteTerminalData === 'function') {
        ctx.subscriptions.push((vscode.window as any).onDidWriteTerminalData((e: any) => {
            const cfg = vscode.workspace.getConfiguration('mjCodeCriminal');
            if (!cfg.get('enabled')) return;

            termBuf = (termBuf + e.data).slice(-2000);
            const cln = termBuf.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '').toLowerCase();
            const errs = ['error:', 'fatal error:', 'build failed', 'npm err!', 'exit code 1'];
            const ok = ['successfully compiled', 'build successful', 'done in'];

            if (errs.some(k => cln.includes(k)) && !errorTimer) {
                scream(ctx, 'error');
                errorTimer = setTimeout(() => { errorTimer = null; }, 1000);
                termBuf = '';
            } else if (ok.some(k => cln.includes(k) && cfg.get('successSounds')) && !errorTimer) {
                scream(ctx, 'success');
                errorTimer = setTimeout(() => { errorTimer = null; }, 1000);
                termBuf = '';
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
}

export function deactivate() {}

