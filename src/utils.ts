import * as vscode from 'vscode';
import { join } from 'path';

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
    addr: string;
    port: number;
}

export function getConfiguration(): SynchronizedConfiguration {
    const config = vscode.workspace.getConfiguration(configurationSection);
    const outConfig: SynchronizedConfiguration = {
      runtime: 'v8',
      remote: false,
      addr: "",
      port: 0
    };

    withConfigValue(config, outConfig, 'runtime');
    withConfigValue(config, outConfig, 'remote');
    withConfigValue(config, outConfig, 'addr');
    withConfigValue(config, outConfig, 'port');

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

export async function runScriptOrNot(): Promise<boolean> {
	const result = await vscode.window.showQuickPick(['Yes', 'No'], {
		placeHolder: 'Do you want to run a script?'
  });

  if (result === "Yes") {
    return true;
  }

  return false;
}


export async function whichScript(): Promise<string> {
	const result = await vscode.window.showOpenDialog({
    canSelectMany: false
  });

  if (result === undefined) {
    return "";
  }

  return result[0].fsPath.toString();
}
