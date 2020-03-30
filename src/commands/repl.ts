import * as vscode from 'vscode';

import { TargetItem, AppItem, ProcessItem } from '../providers/devices';
import { platform } from 'os';
import { DeviceType } from '../types';
import { terminate } from '../driver/frida';
import { refresh, getConfiguration, runScriptOrNot, whichScript } from '../utils';

let NEXT_TERM_ID = 1;
const configuration = getConfiguration();
const runtime = configuration.runtime;
const remote = configuration.remote;

function repl(args: string[], tool: string='frida') {
  let deviceName = args[((args.indexOf("--device") > 0) ? (args.indexOf("--device")) : (args.indexOf("-H"))) + 1];

  const title = `Frida REPL ${runtime} ${deviceName} #${NEXT_TERM_ID++}`;
  
  if (tool === 'frida') {
    args.push('--runtime');
    args.push(runtime);
  }

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

  const runScript = await runScriptOrNot();
  let scriptArgs = [];

  if (runScript === true) {
    const script = await whichScript();

    if (script !== "") {
      scriptArgs.push('-l');
      scriptArgs.push(script);
    }
  }

  let remoteArgs = [];
  if (remote === true) {
    remoteArgs = ['-H', node.device.name];
  } else {
    remoteArgs = ['--device', node.device.id];
  }

  repl(['-f', node.data.identifier, ...remoteArgs, ...scriptArgs, '--no-pause']);
  refresh();
}

export async function spawnSuspended(node?: AppItem) {
  if (!node) {
    // todo: select
    return;
  }

  const runScript = await runScriptOrNot();
  let scriptArgs = [];

  if (runScript === true) {
    const script = await whichScript();

    if (script !== "") {
      scriptArgs.push('-l');
      scriptArgs.push(script);
    }
  }

  let remoteArgs = [];
  if (remote === true) {
    remoteArgs = ['-H', node.device.name];
  } else {
    remoteArgs = ['--device', node.device.id];
  }

  repl(['-f', node.data.identifier, ...remoteArgs, ...scriptArgs]);
  refresh();
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

  const runScript = await runScriptOrNot();
  let scriptArgs = [];

  if (runScript === true) {
    const script = await whichScript();

    if (script !== "") {
      scriptArgs.push('-l');
      scriptArgs.push(script);
    }
  }

  if (node instanceof AppItem || node instanceof ProcessItem) {
    if (!node.data.pid) {
      vscode.window.showErrorMessage(`App "${node.data.name}" must be running before attaching to it`);
    }

    let remoteArgs = [];
    if (remote === true) {
      remoteArgs = ['-H', node.device.name];
    } else {
      remoteArgs = ['--device', node.device.id];
    }

    const device = node.device.type === DeviceType.Local ? [] : remoteArgs;
    repl([node.data.pid.toString(), ...device, ...scriptArgs]);
  }
}