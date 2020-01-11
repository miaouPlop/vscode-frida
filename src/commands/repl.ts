import * as vscode from 'vscode';
import { TargetItem, AppItem, ProcessItem } from '../providers/devices';

let NEXT_TERM_ID = 1;

function repl(args: string[]) {
  const term = vscode.window.createTerminal(`Frida REPL #${NEXT_TERM_ID++}`, 'frida', args);
  term.show();
}

export function spawn(node?: TargetItem) {
  if (!node) {
    // todo: select from list
    return;
  }

  if (node instanceof AppItem) {
    repl(['-f', node.data.identifier, '--device', node.device.id]);
  }
}

export function attach(node?: TargetItem) {
  if (!node) {
    // todo: select from list
    return;
  }

  if (node instanceof AppItem || node instanceof ProcessItem) {
    repl([node.data.pid.toString(), '--device', node.device.id]);
  }
}