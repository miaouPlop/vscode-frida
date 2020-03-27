#!/usr/bin/env python3

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))


def main(args):
    from backend import core, rpc, syslog
    from backend.file import upload, download
    from backend.fs import FileSystem

    if args.action == 'devices':
        return core.devices()

    if not args.device:
        raise RuntimeError('NOTREACHED')

    if args.device == 'tcp':
        if not args.addr:
            raise RuntimeError('Missing option addr to reach remote device')
        device = core.add_remote_device(args.addr)
    else:
        device = core.get_device(args.device)

    if args.action == 'ps':
        return core.ps(device)

    if args.action == 'apps':
        return core.apps(device)

    if args.action == 'type':
        return core.device_type(device)

    target = args.pid or args.name
    agent = rpc.ProcessAgent(device, target) if target else \
        rpc.AppAgent(device, args.app)
    agent.load()

    if args.action == 'rpc':
        return agent.invoke(args.method, *args.args)

    if args.action == 'syslog':
        syslog.pipe(agent)
        return

    fs = FileSystem(agent)

    if args.action == 'fs':
        method = getattr(fs, args.method)
        return method(*args.args)

    if args.action == 'download':
        download(fs, args.path)
        return

    if args.action == 'upload':
        upload(fs, args.path)
        return

    raise RuntimeError('NOTREACHED')


if __name__ == '__main__':
    import argparse

    requires_device = argparse.ArgumentParser(add_help=False)
    requires_device.add_argument('device')
    device_group = requires_device.add_argument_group()
    device_group.add_argument('--addr', type=str)
    device_group.required = False

    requires_path = argparse.ArgumentParser(add_help=False)
    requires_path.add_argument('path')

    requires_app = argparse.ArgumentParser(add_help=False)
    requires_app.add_argument('--device', required=True)
    group = requires_app.add_mutually_exclusive_group()
    group.add_argument('--app')
    group.add_argument('--pid', type=int)
    group.add_argument('--name')
    group.required = True

    parser = argparse.ArgumentParser(description='frida driver')
    subparsers = parser.add_subparsers(dest='action', required=True)
    subparsers.add_parser('devices')
    subparsers.add_parser('apps', parents=[requires_device])
    subparsers.add_parser('ps', parents=[requires_device])
    subparsers.add_parser('type', parents=[requires_device])

    rpc_parser = subparsers.add_parser('rpc', parents=[requires_app])
    rpc_parser.add_argument('method')
    rpc_parser.add_argument('args', metavar='N', nargs='*', default=[])

    subparsers.add_parser('syslog', parents=[requires_app])
    subparsers.add_parser('download', parents=[requires_app, requires_path])
    subparsers.add_parser('upload', parents=[requires_app, requires_path])

    fs_parser = subparsers.add_parser('fs', parents=[requires_app])
    fs_parser.add_argument('method', choices=['cp', 'mkdir', 'rm', 'ls', 'mv', 'stat'])
    fs_parser.add_argument('args', metavar='N', nargs='*', default=[])

    args = parser.parse_args()

    result = main(args)
    import json
    if args.action not in ['syslog', 'download', 'upload']:
        print(json.dumps(result))
