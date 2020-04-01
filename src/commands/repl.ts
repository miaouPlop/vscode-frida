import * as vscode from 'vscode';

import * as fs from 'fs';
import * as path from 'path';

import { TargetItem, AppItem, ProcessItem } from '../providers/devices';
import { platform } from 'os';
import { DeviceType } from '../types';
import { terminate } from '../driver/frida';
import { refresh, getConfiguration, runScriptOrNot, whichScript,
         updateLastReplConfig, getLastReplConfig, getTime } from '../utils';

let NEXT_TERM_ID = 1;
const configuration = getConfiguration();

async function createOptions(node: AppItem | ProcessItem, data: string) {
  const runScript = await runScriptOrNot();
  let scriptArgs: string[] = [];
  let script: string | undefined;

  if (runScript !== 0) {
    if (runScript === 1) {
      script = await whichScript();
    } else {
      script = vscode.window.activeTextEditor?.document.uri.fsPath;
    }

    if (script !== "" && script !== undefined) {
      scriptArgs = ['-l', script];
    }
  }

  let remoteArgs: string[] = ['--device', node.device.id];
  if (configuration.device.enableRemote === true) {
    remoteArgs = ['-H', node.device.name];
  }

  let output: string[] = [];
  if (configuration.output.log === true 
      && configuration.output.saveDirectory !== '') {
    
    let scriptBase = '';
    if (script !== undefined) {
      const scriptParts = path.parse(script);
      scriptBase = `${scriptParts.name}_`;
    }

    const filename = `${scriptBase}${node.device.name}_${data}_${getTime()}.log`;
    output = ['-o', path.join(configuration.output.saveDirectory, filename)];
  }

  if (configuration.output.saveScriptAndLog === true 
      && configuration.output.saveDirectory !== '' 
      && script !== undefined) {
    
        const saveDir = path.join(configuration.output.saveDirectory, 'save');
    
    if (fs.existsSync(saveDir) === false) {
      fs.mkdirSync(saveDir);
    }

    const timeDir = path.join(saveDir, getTime());
    fs.mkdirSync(timeDir);

    const scriptParts = path.parse(script);
    const filename = `${scriptParts.name}_${node.device.name}_${data}_${getTime()}.log`;

    fs.copyFileSync(script, path.join(timeDir, scriptParts.base));
    output = ['-o', path.join(timeDir, filename)];
  }

  return [...scriptArgs, ...remoteArgs, ...output];
}

function repl(args: string[], tool: string='frida') {
  let deviceName = args[((args.indexOf("--device") > 0) ? (args.indexOf("--device")) : (args.indexOf("-H"))) + 1];

  const title = `Frida REPL ${configuration.javascript.runtime} ${deviceName} #${NEXT_TERM_ID++}`;
  
  if (tool === 'frida') {
    args.push('--runtime');
    args.push(configuration.javascript.runtime);
  }

  updateLastReplConfig(args);

  console.log(`${tool} ${args.join(' ')}`);

  if (platform() === 'win32') {
    vscode.window.createTerminal(title, 'cmd.exe', ['/c', tool, ...args]).show();
  } else {
    vscode.window.createTerminal(title, tool, args).show();
  }
}

export async function spawn(node?: AppItem) {
  if (!node) {
    // todo: select from list
    return;
  }

  const args = await createOptions(node, node.data.identifier);

  repl(['-f', node.data.identifier, '--no-pause', ...args]);
  refresh();
}

export async function spawnSuspended(node?: AppItem) {
  if (!node) {
    // todo: select
    return;
  }

  const args = await createOptions(node, node.data.identifier);

  repl(['-f', node.data.identifier, ...args]);
  refresh();
}

export async function runlast() {
  let args = getLastReplConfig();

  if (args.length === 0) {
    return vscode.window.showErrorMessage('No configuration to run yet!');
  }

  if (args.indexOf('-o') > 0) {
    const idx = args.indexOf('-o') + 1;
    const t = getTime();
    
    let dirParts = path.parse(args[idx]).dir.split(path.sep);
    dirParts[dirParts.length - 1] = `${t}`;
    const dir = dirParts.join(path.sep);
    
    fs.mkdirSync(dir);

    if (args.indexOf('-l') > 0) {
      const scriptParts = path.parse(args[args.indexOf('-l') + 1]);
      fs.copyFileSync(args[args.indexOf('-l') + 1], path.join(dir, scriptParts.base));
    }

    let fnameParts = path.parse(args[idx]).base.split('_');
    fnameParts[fnameParts.length - 1] = `${t}.log`;

    args[idx] = path.join(dir, fnameParts.join('_'));
  }

  repl(args);
  refresh();

  vscode.window.showInformationMessage(`Running frida ${args.join(' ')}`);
}

export function kill(node?: TargetItem) {
  if (!node) {
    return;
  }

  if ((node instanceof AppItem && node.data.pid) || node instanceof ProcessItem) {
    terminate(node.device.id, node.data.pid.toString());
    refresh();
  } else {
    vscode.window.showWarningMessage(`Target is not running`);
  }
}

export async function attach(node?: TargetItem) {
  if (!node) {
    // todo: select from list
    return;
  }

  if (node instanceof AppItem || node instanceof ProcessItem) {
    if (!node.data.pid) {
      vscode.window.showErrorMessage(`App "${node.data.name}" must be running before attaching to it`);
    }

    const args = await createOptions(node, node.data.pid.toString());
    
    repl([node.data.pid.toString(), ...args]);
  }
}