import readline from 'node:readline';
import { catalog } from './catalog.mjs';

const esc = '\u001b[';
const color = {
  reset: `${esc}0m`, bold: `${esc}1m`, dim: `${esc}2m`, green: `${esc}38;2;155;236;91m`,
  white: `${esc}38;2;225;229;227m`, gray: `${esc}38;2;91;99;96m`, red: `${esc}38;2;255;104;104m`,
  redBg: `${esc}48;2;68;31;34m`, panel: `${esc}48;2;20;23;27m`, bar: `${esc}48;2;24;27;32m`,
  cursor: `${esc}48;2;155;236;91m${esc}38;2;16;18;22m`,
};
const languages = Object.keys(catalog);
const lengths = ['short', 'medium', 'long', 'thicc'];

if (!process.stdin.isTTY || !process.stdout.isTTY) {
  console.error('CodeType needs an interactive terminal. Run: npm.cmd start');
  process.exit(1);
}

let screen = 'language';
let languageIndex = 0;
let lengthIndex = 0;
let selectedLanguage = languages[0];
let selectedLength = lengths[0];
let exercise = null;
let types = '';
let startedAt = null;
let finishedAt = null;
let indentJumps = [];
let timer;

readline.emitKeypressEvents(process.stdin);
process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.setEncoding('utf8');
process.stdout.write(`${esc}?1049h${esc}?25l`);

const visibleLength = (text) => text.replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, '').length;
const pad = (text, width) => text + ' '.repeat(Math.max(0, width - visibleLength(text)));
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const currentCode = () => exercise?.source ?? '';
const width = () => Math.max(66, (process.stdout.columns || 92) - 1);
const fit = (text, maximum) => text.length > maximum ? `…${text.slice(-(maximum - 1))}` : text;

function boxLine(text, boxWidth, background = color.panel) {
  return `${background}│${color.reset}${background}${pad(` ${text}`, boxWidth - 2)}${color.reset}${background}│${color.reset}`;
}

function draw(lines) {
  process.stdout.write(`${esc}?2026h${esc}H${lines.map((line) => `${line}${esc}K`).join('\n')}${esc}J${esc}?2026l`);
}

function elapsedSeconds() {
  if (!startedAt) return 0;
  return Math.max(1, Math.floor(((finishedAt ?? Date.now()) - startedAt) / 1000));
}

function stats(code) {
  let correct = 0;
  for (let index = 0; index < typed.length; index += 1) if (typed[index] === code[index]) correct += 1;
  const seconds = elapsedSeconds();
  return {
    accuracy: typed.length ? Math.round((correct / typed.length) * 100) : 100,
    wpm: startedAt ? Math.round(correct / 5 / (seconds / 60)) : 0,
    seconds,
    progress: code.length ? Math.round((typed.length / code.length) * 100) : 0,
  };
}

function formatTime(seconds) {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function renderMenu(title, options, activeIndex, footer) {
  const boxWidth = width();
  const inner = boxWidth - 2;
  const output = [
    `${color.bold}${color.green}  </> ${color.white}codetype_${color.reset}`,
    `${color.dim}${'─'.repeat(boxWidth)}${color.reset}`,
    '',
    `  ${color.green}${color.bold}${title}${color.reset}`,
    `  ${color.gray}${footer}${color.reset}`,
    '',
    `${color.bar}┌${'─'.repeat(inner)}┐${color.reset}`,
  ];
  options.forEach((option, index) => {
    const selected = index === activeIndex;
    const label = selected ? `${color.green}${color.bold}›  ${option}${color.reset}${color.panel}` : `${color.gray}   ${option}${color.reset}${color.panel}`;
    output.push(boxLine(label, boxWidth));
  });
  const menuBodyRows = Math.max(options.length, (process.stdout.rows || 28) - 9);
  for (let row = options.length; row < menuBodyRows; row += 1) {
    output.push(boxLine('', boxWidth));
  }
  output.push(`${color.panel}└${'─'.repeat(inner)}┘${color.reset}`);
  output.push(`  ${color.gray}[↑/↓] choose   [enter] select   [ctrl+c] quit${color.reset}`);
  draw(output);
}

function renderPractice() {
  const code = currentCode();
  const result = stats(code);
  const boxWidth = width();
  const inner = boxWidth - 2;
  const allLines = code.split('\n');
  const currentLine = code.slice(0, typed.length).split('\n').length - 1;
  const availableRows = Math.max(8, (process.stdout.rows || 28) - 10);
  const startLine = clamp(currentLine - 2, 0, Math.max(0, allLines.length - Math.max(1, availableRows - 2)));
  const sourceRows = Math.max(1, availableRows - (startLine > 0 ? 1 : 0) - 1);
  const endLine = Math.min(allLines.length, startLine + sourceRows);
  let offset = allLines.slice(0, startLine).reduce((total, line) => total + line.length + 1, 0);
  const fileName = fit(exercise.name, Math.max(24, inner - 24));
  const output = [
    `${color.bold}${color.green}  </> ${color.white}codetype_${color.reset}`,
    `${color.dim}${'─'.repeat(boxWidth)}${color.reset}`,
    `  ${color.green}${selectedLanguage.toUpperCase()}${color.reset}  ${color.gray}${selectedLength}${color.reset}     ${color.green}⚡${color.reset} ${color.bold}${result.wpm}${color.reset} wpm     ${color.green}◷${color.reset} ${formatTime(result.seconds)}     ${color.green}%${color.reset} ${result.accuracy}%     ${color.gray}${result.progress}%${color.reset}`,
    '',
    `${color.bar}┌${'─'.repeat(inner)}┐${color.reset}`,
    boxLine(` ●  ●  ●    ${color.white}${fileName}${color.reset}${color.bar}`, boxWidth, color.bar),
    `${color.panel}├${'─'.repeat(inner)}┤${color.reset}`,
  ];

  let bodyRows = 0;
  if (startLine > 0) {
    output.push(boxLine(`${color.gray}      ↑ ${startLine} lines above${color.reset}${color.panel}`, boxWidth));
    bodyRows += 1;
  }
  for (let lineIndex = startLine; lineIndex < endLine; lineIndex += 1) {
    const line = allLines[lineIndex];
    let painted = '';
    for (let column = 0; column < line.length; column += 1) {
      const index = offset + column;
      const character = line[column];
      if (index < typed.length) painted += typed[index] === character ? `${color.white}${character}` : `${color.redBg}${color.red}${character}${color.panel}`;
      else if (index === typed.length) painted += `${color.cursor}${character}${color.reset}${color.panel}${color.gray}`;
      else painted += `${color.gray}${character}`;
    }
    if (offset + line.length === typed.length) painted += `${color.cursor} ${color.reset}${color.panel}`;
    const lineNumber = `${color.gray}${String(lineIndex + 1).padStart(3)} │${color.reset}${color.panel}`;
    output.push(boxLine(`${lineNumber} ${painted}${color.reset}${color.panel}`, boxWidth));
    offset += line.length + 1;
    bodyRows += 1;
  }
  if (endLine < allLines.length) {
    output.push(boxLine(`${color.gray}      ↓ ${allLines.length - endLine} lines below${color.reset}${color.panel}`, boxWidth));
    bodyRows += 1;
  }
  for (; bodyRows < availableRows; bodyRows += 1) output.push(boxLine('', boxWidth));
  output.push(`${color.panel}└${'─'.repeat(inner)}┘${color.reset}`);
  output.push(`  ${finishedAt ? `${color.green}${color.bold}complete — ${result.wpm} wpm · ${result.accuracy}% accuracy${color.reset}` : `${color.gray}enter handles indentation · backspace returns across auto-indent${color.reset}`}`);
  output.push(`  ${color.gray}[tab] random file   [esc] restart   [alt+c] back   [ctrl+c] quit${color.reset}`);
  draw(output);
}

function render() {
  if (screen === 'language') return renderMenu('Choose a language', languages, languageIndex, 'Source code from the repositories you selected.');
  if (screen === 'length') return renderMenu(`${selectedLanguage} · choose a length`, lengths, lengthIndex, 'Short warm-up or a gloriously thicc file?');
  renderPractice();
}

function resetPractice() {
  typed = '';
  startedAt = null;
  finishedAt = null;
  indentJumps = [];
  render();
}

function chooseRandomExercise() {
  const choices = catalog[selectedLanguage][selectedLength];
  if (!choices?.length) return;
  const alternatives = choices.length > 1 ? choices.filter((item) => item.name !== exercise?.name) : choices;
  exercise = alternatives[Math.floor(Math.random() * alternatives.length)];
  screen = 'practice';
  resetPractice();
}

function typeCharacter(character) {
  const code = currentCode();
  if (finishedAt || typed.length >= code.length) return;
  if (!startedAt) startedAt = Date.now();
  typed += character;
  if (typed.length >= code.length) finishedAt = Date.now();
  render();
}

function cleanup(exitCode = 0) {
  clearInterval(timer);
  process.stdin.setRawMode(false);
  process.stdin.pause();
  process.stdout.write(`${color.reset}${esc}?25h${esc}?1049l`);
  process.exit(exitCode);
}

function moveSelection(key, size, current) {
  if (key.name === 'up' || key.name === 'w') return (current - 1 + size) % size;
  if (key.name === 'down' || key.name === 's') return (current + 1) % size;
  return current;
}

process.stdin.on('keypress', (character, key) => {
  if (key.ctrl === true && key.name === 'c') return cleanup();

  if (screen === 'language') {
    languageIndex = moveSelection(key, languages.length, languageIndex);
    if (key.name === 'return' || key.name === 'enter') {
      selectedLanguage = languages[languageIndex];
      screen = 'length';
    }
    return render();
  }

  if (screen === 'length') {
    lengthIndex = moveSelection(key, lengths.length, lengthIndex);
    if (key.name === 'escape' || key.name === 'backspace' || key.name === 'left') screen = 'language';
    if (key.name === 'return' || key.name === 'enter') {
      selectedLength = lengths[lengthIndex];
      return chooseRandomExercise();
    }
    return render();
  }

  if (key.meta === true && key.name === 'c') { screen = 'language'; return render(); }
  if (key.name === 'escape') return resetPractice();
  if (key.name === 'tab') return chooseRandomExercise();
  if (key.name === 'backspace') {
    if (typed.length && !finishedAt) {
      const lastJump = indentJumps.at(-1);
      if (lastJump && typed.length === lastJump.to) {
        typed = typed.slice(0, lastJump.from);
        indentJumps.pop();
      } else typed = typed.slice(0, -1);
    }
    return render();
  }
  if (key.name === 'return' || key.name === 'enter') {
    const code = currentCode();
    if (code[typed.length] !== '\n') return typeCharacter('\n');
    const indentation = code.slice(typed.length + 1).match(/^[\t ]*/)?.[0] ?? '';
    if (!startedAt) startedAt = Date.now();
    const from = typed.length;
    typed += `\n${indentation}`;
    indentJumps.push({ from, to: typed.length });
    if (typed.length >= code.length) finishedAt = Date.now();
    return render();
  }
  if (!key.ctrl && !key.meta && character && character >= ' ') typeCharacter(character);
});

process.stdout.on('resize', render);
process.on('SIGTERM', cleanup);
timer = setInterval(() => { if (screen === 'practice' && startedAt && !finishedAt) render(); }, 1000);
render();
