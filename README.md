# MJ Code Criminal

**"Hee-Hee!"** — As he came into the file, it was a code criminal!

MJ Code Criminal plays legendary Michael Jackson voice clips whenever your code has errors or your build fails.

## Features

- **Iconic Clips**: Randomly plays "Shamone", "Hee-Hee", "Aaow!", and more when errors occur.
- **Fast Performance**: Uses a native PowerShell audio engine for zero-latency screams.
- **Smart Detection**: Monitors VS Code diagnostics (TypeScript, ESLint, Python, etc.) and terminal output (npm, cargo, tsc).
- **Cooldown Mode**: Prevents overlapping audio if multiple errors appear at once.

## Commands

Open the Command Palette (Ctrl+Shift+P) and search for **MJ**:

- MJ: Test Error Sound - Test a random MJ error clip.
- MJ: Test Success Sound - Verify the success notification.
- MJ: Toggle On/Off - Quickly enable or disable MJ.

## Configuration

Customize MJ in your VS Code settings:

| Setting | Default | Description |
| --- | --- | --- |
| mjCodeCriminal.enabled | true | Enable/Disable the extension globally. |
| mjCodeCriminal.volume | 1.0 | Set playback volume (0.0 to 1.0). |
| mjCodeCriminal.successSounds | true | Play a notification when all errors are cleared. |

## Requirements

- **Windows**: Uses PowerShell for audio playback.

## Known Issues

- Currently optimized for Windows. Support for macOS and Linux is coming soon!

---

**Shamone!** Happy coding.
