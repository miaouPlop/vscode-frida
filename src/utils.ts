import * as vscode from 'vscode';
import { join } from 'path';
import { platform } from 'os';

interface IJavaScriptSettings {
  runtime: 'v8' | 'duk';
}

interface IDeviceSettings {
  enableRemote: boolean;
  remoteAddresses: string[];
}

interface IOutputSettings {
  log: boolean;
  saveScriptAndLog: boolean;
  saveDirectory: string;
}

interface IFridaSettings {
  javascript: IJavaScriptSettings;
  device: IDeviceSettings;
  output: IOutputSettings;
}

interface IReplArgs {
  
}

const configurationSection = 'frida';

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

export function getConfiguration(): IFridaSettings {
  const config = vscode.workspace.getConfiguration(configurationSection);
  const outConfig: IFridaSettings = {
    javascript: {
      runtime: config.get('javascript.runtime', 'v8')
    },
    device: {
      enableRemote: config.get('device.enableRemote', false),
      remoteAddresses: config.get('device.remoteAddresses', [])
    },
    output: {
      log: config.get('output.log', false),
      saveScriptAndLog: config.get('output.saveScriptAndLog', false),
      saveDirectory: config.get('output.saveDirectory', '')
    }
  };

  return outConfig;
}

export function getTime(): string {
  const config = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' };
  const format = new Intl.DateTimeFormat('en', config);
  const [{ value: mo },, { value: da },, { value: ye },, { value: ho },, { value: mi },, { value: se}] = format.formatToParts(new Date());

  return `${ye}${mo}${da}${ho}${mi}${se}`;
}

export async function runScriptOrNot(): Promise<number> {
  let document = undefined;
  
  if (vscode.window.activeTextEditor) {
    document = vscode.window.activeTextEditor.document; 
  }

  let options = ['No', 'Choose script'];

  if (document !== undefined && document.languageId === 'javascript') {
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
