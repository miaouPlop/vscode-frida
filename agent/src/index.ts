import * as fs from './fs';
import { start, stop } from './log';
import { enumerateJavaClasses, enumerateClassMethods } from './classes';

const ping = () => Process.id;

rpc.exports = {
    fs: fs.invoke,
    start,
    stop,
    ping,
    jclasses: enumerateJavaClasses,
    jmethods: enumerateClassMethods
};
