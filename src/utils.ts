import * as vscode from 'vscode';
import { join } from 'path';
import { platform } from 'os';

const configurationSection = 'vscodefrida';

export function resource(...paths: string[]): vscode.Uri {
  const file = join(__dirname, '..', 'resources', ...paths);
  return vscode.Uri.file(file);
}

export function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function refresh() {
  vscode.commands.executeCommand('frida.ps.refresh');
  vscode.commands.executeCommand('frida.apps.refresh');
}

interface SynchronizedConfiguration {
  runtime: 'v8' | 'duk';
  remote: boolean;
  addr: string[];
}

export function getConfiguration(): SynchronizedConfiguration {
  const config = vscode.workspace.getConfiguration(configurationSection);
  const outConfig: SynchronizedConfiguration = {
    runtime: 'v8',
    remote: false,
    addr: [],
  };

  withConfigValue(config, outConfig, 'runtime');
  withConfigValue(config, outConfig, 'remote');
  withConfigValue(config, outConfig, 'addr');

  return outConfig;
}

function withConfigValue<C, K extends Extract<keyof C, string>>(
  config: vscode.WorkspaceConfiguration,
  outConfig: C,
  key: K,
): void {
  const configSetting = config.inspect<C[K]>(key);
  if (!configSetting) {
      return;
  }

  // Make sure the user has actually set the value.
  // VS Code will return the default values instead of `undefined`, even if user has not don't set anything.
  if (typeof configSetting.globalValue === 'undefined'
    && typeof configSetting.workspaceFolderValue === 'undefined'
    && typeof configSetting.workspaceValue === 'undefined'
  ) {
    return;
  }

  const value = config.get<vscode.WorkspaceConfiguration[K] | undefined>(key, undefined);
  if (typeof value !== 'undefined') {
    (outConfig as any)[key] = value;
  }
}

export async function runScriptOrNot(): Promise<number> {
  if (!vscode.window.activeTextEditor) {
    return 0;
  }
  
  let { document } = vscode.window.activeTextEditor;
  let options = ['No', 'Choose script'];

  if (document.languageId === 'javascript') {
    options = ['No', 'Choose script', 'Current script'];
  }

	const result = await vscode.window.showQuickPick(options, {
		placeHolder: 'Do you want to run a script?'
  });

  if (result === undefined) {
    return 0;
  }

  return options.indexOf(result);
}


export async function whichScript(): Promise<string> {
	const result = await vscode.window.showOpenDialog({
    canSelectMany: false
  });

  if (result === undefined) {
    return "";
  }

  let doc = await vscode.workspace.openTextDocument(result[0]);
  await vscode.window.showTextDocument(doc, { preview: false });
  
  return result[0].fsPath.toString();
}


export function platformize(tool: string, args: string[]): [string, string[]] {
  let bin = tool;
  let joint = args;
  if (platform() === 'win32') {
    bin = 'cmd.exe';

    // use python3 on Windows with multiple versions installed
    if (tool === 'python3') {
      tool = 'py';
      args.splice(0, 0, '-3');
    }

    joint = ['/c', tool, ...args];
  }

  return [bin, joint];
}

let lastReplConfig: any[] = [];

export function updateLastReplConfig(args: string[]) {
  lastReplConfig = args;
}

export function getLastReplConfig() {
  return lastReplConfig;
}
