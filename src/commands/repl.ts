import * as vscode from 'vscode';

import { TargetItem, AppItem, ProcessItem } from '../providers/devices';
import { platform } from 'os';
import { DeviceType } from '../types';
import { terminate } from '../driver/frida';
import { refresh, getConfiguration } from '../utils';

let NEXT_TERM_ID = 1;
const configuration = getConfiguration();
const runtime = configuration.runtime;
const remote = configuration.remote;
const address = `${configuration.addr}:${configuration.port}`;

function repl(args: string[], tool: string='frida') {
  const title = `Frida REPL ${runtime} ${remote ? address : 'DEVICE'} #${NEXT_TERM_ID++}`;
  
  if (tool === 'frida') {
    args.push('--runtime');
    args.push(runtime);
  }

  if (platform() === 'win32') {
    vscode.window.createTerminal(title, 'cmd.exe', ['/c', tool, ...args]).show();
  } else {
    vscode.window.createTerminal(title, tool, args).show();
  }
}

export function spawn(node?: AppItem) {
  if (!node) {
    // todo: select from list
    return;
  }

  let remoteArgs = [];
  if (remote === true) {
    remoteArgs = ['-H', address];
  } else {
    remoteArgs = ['--device', node.device.id];
  }

  repl(['-f', node.data.identifier, ...remoteArgs, '--no-pause']);
  refresh();
}

export function spawnSuspended(node?: AppItem) {
  if (!node) {
    // todo: select
    return;
  }

  let remoteArgs = [];
  if (remote === true) {
    remoteArgs = ['-H', address];
  } else {
    remoteArgs = ['--device', node.device.id];
  }

  repl(['-f', node.data.identifier, ...remoteArgs]);
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

export function attach(node?: TargetItem) {
  if (!node) {
    // todo: select from list
    return;
  }

  if (node instanceof AppItem || node instanceof ProcessItem) {
    if (!node.data.pid) {
      vscode.window.showErrorMessage(`App "${node.data.name}" must be running before attaching to it`);
    }

    let remoteArgs = [];
    if (remote === true) {
      remoteArgs = ['-H', address];
    } else {
      remoteArgs = ['--device', node.device.id];
    }

    const device = node.device.type === DeviceType.Local ? [] : remoteArgs;
    repl([node.data.pid.toString(), ...device]);
  }
}