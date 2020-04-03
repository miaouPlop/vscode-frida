import * as vscode from 'vscode';

import * as fs from 'fs';
import * as path from 'path';

import * as ipc from '../driver/frida';

import { resource } from '../utils';
import { ProviderType, App, Process, Device, Klass } from '../types';
// import { KlassItem } from './classes';

export class DevicesProvider implements vscode.TreeDataProvider<TargetItem> {

  private _onDidChangeTreeData: vscode.EventEmitter<TargetItem | undefined> = new vscode.EventEmitter<TargetItem | undefined>();
  readonly onDidChangeTreeData: vscode.Event<TargetItem | undefined> = this._onDidChangeTreeData.event;

  constructor(
    public readonly type: ProviderType
  ) {

  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TargetItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: TargetItem): Thenable<TargetItem[]> {
    if (element) {
      return element.children();
    } else {
      return ipc.devices().then(devices => devices.map(device => new DeviceItem(device, this.type)));
    }
  }
}

export abstract class TargetItem extends vscode.TreeItem {
  abstract children(): Thenable<TargetItem[]>;
}

export class DeviceItem extends TargetItem {
  constructor(
    public readonly data: Device,
    public readonly type: ProviderType,
  ) {
    super(data.name, vscode.TreeItemCollapsibleState.Collapsed);
  }

  get tooltip(): string {
    return `${this.data.id} (${this.data.type})`;
  }

  get description(): string {
    return this.data.id;
  }

  get iconPath() {
    return {
      light: resource('light', `${this.data.type}.svg`),
      dark: resource('dark', `${this.data.type}.svg`),
    };
  }

  children(): Thenable<TargetItem[]> {
    const device = this.data;
    if (this.type === ProviderType.Apps) {
      return ipc.apps(device.id)
        .then(apps => apps.map(app => new AppItem(app, device)))
        .catch(e => [new NotFound(e, device)]);
    } else if (this.type === ProviderType.Processes) {
      return ipc.ps(device.id)
        .then(ps => ps.map(p => new ProcessItem(p, device)))
        .catch(e => [new NotFound(e, device)]);
    }
    return Promise.resolve([]);
  }

  contextValue = 'device';
}

export class NotFound extends TargetItem {
  constructor(
    public readonly reason: Error,
    public readonly device: Device,
  ) {
    super(reason.message, vscode.TreeItemCollapsibleState.None);
  }

  children(): Thenable<TargetItem[]> {
    return Promise.resolve([]);
  }

  get tooltip() { return this.reason.message; }

  iconPath = {
    dark: resource('dark', 'error.svg'),
    light: resource('light', 'error.svg')
  };

  contextValue = 'empty';
}

export class AppItem extends TargetItem {
  constructor(
    public readonly data: App,
    public readonly device: Device,
  ) {
    super(data.name, vscode.TreeItemCollapsibleState.None);
  }

  get tooltip(): string {
    return `${this.label} (${this.data.pid || 'Not Running'})`;
  }

  get description(): string {
    return this.data.identifier;
  }

  children(): Thenable<TargetItem[]> {
    return Promise.resolve([]);
  }


  get iconPath() {
    if (this.data.largeIcon) {
      return vscode.Uri.parse(this.data.largeIcon);
    }

    const img = this.data.pid ? 'statusRun.svg' : 'statusStop.svg';
    return {
      dark: resource('dark', img),
      light: resource('light', img)
    };
  }

  get contextValue() {
    return `app|${this.data.pid ? 'running' : 'dead'}`;
  }
}

class NNode {
  type: string;
  name: string;
  fname: string;
  pname?: string;
  nodes: NNode[];

  constructor(type: string, name: string, fname: string) {
    this.type = type;
    this.name = name;
    this.fname = fname;
    this.nodes = [];
  }

  addNode(node: NNode) {
    this.nodes.push(node);
  }

  addParent(parent: string) {
    this.pname = parent;
  }
}

function sortByPackages(klasses: string[]): NNode[] {
  let packages: { [id: string]: NNode } = {};

  klasses.sort().map(klass => {
    const kparts: string[] = klass.split('.');
    const kname: string = kparts[kparts.length - 1];
  
    for (let i = 0; i < kparts.length; i++) {
      const npackage: string = kparts[i];
      const fpackage: string = kparts.slice(0, i+1).join('.');
  
      if (packages[fpackage] === undefined) {
        let n: NNode = new NNode("package", npackage, fpackage);
        if (npackage === kname) {
          n = new NNode("class", npackage, fpackage);
        }
  
        packages[fpackage] = n;
  
        if (i > 0) {
          const ppackage: string = kparts.slice(0, i).join('.');
          packages[ppackage].addNode(n);
          n.addParent(ppackage);
        }
      }
    }
  });

  g_Packages = packages;

  return Object.values(packages);
}

let g_Packages: { [id: string]: NNode } = {'': new NNode('', '', '')};

export class ProcessItem extends TargetItem {
  constructor(
    public readonly data: Process,
    public readonly device: Device,
  ) {
    super(data.name, vscode.TreeItemCollapsibleState.Collapsed);
  }

  get tooltip(): string {
    return `${this.label} (${this.data.pid})`;
  }

  get description(): string {
    return this.data.pid.toString();
  }

  children(): Thenable<TargetItem[]> {
    return ipc.klasses(this.device.id, this.data.pid.toString())
      .then(f => {
        const content = fs.readFileSync(f.tempfile);
        const klasses: string[] = JSON.parse(content);
        fs.unlinkSync(f.tempfile);

        let items: TargetItem[] = [new NotFound(new Error("typescript..."), this.device)];
        sortByPackages(klasses).map(p => {
          if (p.type === 'package' && p.pname === undefined) {
            items.push(new PackageItem({name: p.name, fname: p.name, largeIcon: 'error.svg', smallIcon: 'error.svg'}, this.data, this.device));
          }
        });

        if (items.length > 1) {
          items = items.slice(1);
        }

        return items;
      })
      .catch(e => [new NotFound(e, this.device)]);
  }

  get iconPath() {
    if (this.data.largeIcon) {
      return vscode.Uri.parse(this.data.largeIcon);
    }

    const img = this.data.pid ? 'statusRun.svg' : 'statusStop.svg';
    return {
      dark: resource('dark', img),
      light: resource('light', img)
    };
  }

  get contextValue() {
    return `process|${this.data.pid ? 'running' : 'dead'}`;
  }
}

export class PackageItem extends TargetItem {
  constructor(
    public readonly data: Klass,
    public readonly process: Process,
    public readonly device: Device,
  ) {
    super(data.name, vscode.TreeItemCollapsibleState.Collapsed);
  }

  get tooltip(): string {
    return `Package ${this.label} (${this.data.fname})`;
  }

  get description(): string {
    return this.data.name;
  }

  children(): Thenable<TargetItem[]> {
    let items: TargetItem[] = [new NotFound(new Error("typescript..."), this.device)];
    let sub = g_Packages[this.data.fname].nodes;
    sub.map(p => {
      if (p.type === 'package') {
        items.push(new PackageItem({name: p.name, fname: p.fname, largeIcon: 'error.svg', smallIcon: 'error.svg'}, this.process, this.device));
      } else {
        items.push(new KlassItem({name: p.name, fname: p.fname, largeIcon: 'error.svg', smallIcon: 'error.svg'}, this.process, this.device));
      }
    });

    if (items.length > 1) {
      items = items.slice(1);
    }

    return Promise.resolve(items);
  }

  get iconPath() {
    if (this.data.largeIcon) {
      return vscode.Uri.parse(this.data.largeIcon);
    }

    return {
      dark: resource('dark', 'error.svg'),
      light: resource('light', 'error.svg')
    };
  }

  get contextValue() {
    return `class`;
  }
}

export class KlassItem extends TargetItem {
  constructor(
    public readonly data: Klass,
    public readonly process: Process,
    public readonly device: Device,
  ) {
    super(data.name, vscode.TreeItemCollapsibleState.None);
  }

  get tooltip(): string {
    return `Class ${this.label} (${this.data.fname})`;
  }

  get description(): string {
    return this.data.name;
  }

  children(): Thenable<TargetItem[]> {
    return Promise.resolve([]);
  }

  get iconPath() {
    if (this.data.largeIcon) {
      return vscode.Uri.parse(this.data.largeIcon);
    }

    return {
      dark: resource('dark', 'error.svg'),
      light: resource('light', 'error.svg')
    };
  }

  get contextValue() {
    return `class`;
  }
}