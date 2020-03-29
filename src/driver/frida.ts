import { join } from 'path';

import { execFile, spawn } from 'child_process';
import { Device, App, Process } from '../types';

import * as os from 'os';

import { VSCodeWriteFileOptions } from '../providers/filesystem';
import { getConfiguration, runScriptOrNot, whichScript } from '../utils';

const py = join(__dirname, '..', '..', 'backend', 'driver.py');
const configuration = getConfiguration();
const runtime = configuration.runtime;
const remote = configuration.remote;
const address = `${configuration.addr}:${configuration.port}`;

export function platformize(tool: string, args: string[]): [string, string[]] {
  let bin = tool;
  let joint = args;
  if (os.platform() === 'win32') {
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

export function exec(...params: string[]): Promise<any> {
  const [bin, args] = platformize('python3', [py, ...params]);

  return new Promise((resolve, reject) => {
    execFile(bin, args, {}, (err, stdout, stderr) => {
      if (err) {
        reject(err);
      } else {
        resolve(JSON.parse(stdout));
      }
    });
  });
}

export function devices() {
  return exec('devices') as Promise<Device[]>;
}

export function apps(id: string) {
  let params = ['apps', id];

  if (id === 'tcp') {
    if (remote === true) {
      params.push('--addr');
      params.push(address);
    }
  }
  
  return exec(...params) as Promise<App[]>;
}

export function ps(id: string) {
  let params = ['ps', id];

  if (id === 'tcp') {
    if (remote === true) {
      params.push('--addr');
      params.push(address);
    }
  }
  
  return exec(...params) as Promise<Process[]>;
}

export function devtype(id: string) {
  let params = ['type', id];

  if (id === 'tcp') {
    if (remote === true) {
      params.push('--addr');
      params.push(address);
    }
  }
  
  return exec(...params) as Promise<string>;
}

export async function launch(device: string, bundle: string): Promise<Number> {
  let remoteParams = [];

  if (device === 'tcp') {
    if (remote === true) {
      remoteParams.push('-H');
      remoteParams.push(address);
    }
  } else {
    remoteParams.push('--device');
    remoteParams.push(device);
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

  const params = ['-f', bundle, ...remoteParams, bundle, '--no-pause', '-q', '-e', 'Process.id', ...scriptArgs];
  const [bin, args] = platformize('frida', params);

  return new Promise((resolve, reject) => {
    execFile(bin, args, {}, (err, stdout) => {
      if (err) {
        reject(err);
      } else {
        const lines = stdout.split('\n');
        if (lines.length <= 2) {
          reject(new Error(`Unknown output: ${stdout}`));
        }
        resolve(parseInt(lines[1], 10));
      }
    });
  });
}

export function terminate(device: string, target: string) {
  let remoteParams = [];

  if (device === 'tcp') {
    if (remote === true) {
      remoteParams.push('-H');
      remoteParams.push(address);
    }
  } else {
    remoteParams.push('--device');
    remoteParams.push(device);
  }

  const [bin, args] = platformize('frida-kill', [...remoteParams, target]);

  return new Promise((resolve, reject) => {
    execFile(bin, args, {}, (err, stdout) => {
      if (err) {
        reject(err);
      } else {
        resolve(stdout);
      }
    });
  });
}

export namespace fs {
  export async function download(device: string, pid: number, uri: string): Promise<Uint8Array> {
    let remoteParams = [];
  
    if (device === 'tcp') {
      if (remote === true) {
        remoteParams.push('--addr');
        remoteParams.push(address);
      }
    } else {
      remoteParams.push('--device');
      remoteParams.push(device);
    }
  
    const params = [py, 'download', uri, ...remoteParams, '--pid', pid.toString()];
    const [bin, args] = platformize('python3', params);
  

    return new Promise((resolve, reject) => {
      const p = spawn(bin, args);
      const parts: Buffer[] = [];
      p.stdout.on('data', data => parts.push(data));
      p.on('close', (code, signal) => {
        if (code === 0) {
          resolve(new Uint8Array(Buffer.concat(parts)));
        } else {
          reject(new Error(`process exited with code ${code}`));
        }
      });
    });
  }

  export async function upload(device: string, pid: number, uri: string, content: Uint8Array,
    options: VSCodeWriteFileOptions): Promise<void> {
    let remoteParams = [];
  
    if (device === 'tcp') {
      if (remote === true) {
        remoteParams.push('--addr');
        remoteParams.push(address);
      }
    } else {
      remoteParams.push('--device');
      remoteParams.push(device);
    }
    
    // todo: options
    const params = [py, 'upload', uri, ...remoteParams, '--pid', pid.toString()];
    const [bin, args] = platformize('python3', params);

    return new Promise((resolve, reject) => {
      const p = spawn(bin, args);
      p.on('close', (code: number, signal: NodeJS.Signals) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`process exited with code ${code}`));
        }
      });
      p.stdin.end(Buffer.from(content));
    });
  }
}
