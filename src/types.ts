
export enum ProviderType {
  Apps = 'apps',
  Processes = 'ps',
  Klasses = 'cl',
  Methods = 'me',
}

export enum DeviceType {
  Local = 'local',
  Remote = 'remote',
  USB = 'usb',
  TCP = 'tcp', // legacy
}

export class Device {
  id: string = '';
  name: string = '';
  type: DeviceType = DeviceType.Local;
  icon: string = '';
}

export enum ItemType {
  device = 'Device',
  app = 'App',
  process = 'Process'
}

export class App {
  identifier: string = '';
  name: string = '';
  pid: number = 0;
  largeIcon: string = '';
  smallIcon: string = '';
}

export class Process {
  name: string = '';
  pid: number = 0;
  largeIcon: string = '';
  smallIcon: string = '';
}

export class Klass {
  name: string = '';
  fname: string = '';
  largeIcon: string = 'error.svg';
  smallIcon: string = 'error.svg';
}

export class Method {
  name: string = '';
  largeIcon: string = 'error.svg';
  smallIcon: string = 'error.svg';
}