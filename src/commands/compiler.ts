import * as vscode from 'vscode';

import * as fs from 'fs';
import * as path from 'path';
import * as cp from 'child_process';
import { platformize } from '../utils';

let NEXT_TERM_ID = 1;

export function compile(param: any): boolean {
  console.log(typeof param);
  console.log(param);

  const title = `Frida agent compiler #${NEXT_TERM_ID++}`;

  const dirName = path.dirname(param.fsPath);
  const parentDir = fs.realpathSync(`${dirName}/..`);
  const dirPackage = ((fs.existsSync(`${dirName}/package.json`)) ? dirName :
                       (fs.existsSync(`${parentDir}/package.json`)) ? parentDir : undefined);

  console.log(dirName, parentDir, dirPackage);

  if (dirPackage === undefined) {
    vscode.window.showErrorMessage('This file is not in a valid node package. Missing package.json');
    
    return false;
  }
  
  let item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
  item.text = 'Compiling your toy';
  item.color = 'orange';
  item.show();

  const [bin, args] = platformize('npm', ['install']);

  vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: "Compilation of frida agent",
    cancellable: false
  }, (progress) => {
    return new Promise((resolve, reject) => {
      cp.execFile(bin, args, {cwd: dirPackage, env: process.env, }, (e, stdout, stderr) => {
        if (e) {
          vscode.window.showErrorMessage(`Could not compile the agent at ${dirPackage}\n${stderr}`);
          item.color = 'red';
          item.text = 'Compilation failed';
          setTimeout(() => item.dispose(), 5000);

          setTimeout(() => reject(), 5000);
        } else {
          progress.report({increment: 100, message: `Successfully compiled ${dirPackage}`});
          item.color = 'green';
          item.text = 'Compilation sucessful';
          setTimeout(() => item.dispose(), 5000);

          setTimeout(() => resolve(), 5000);
        }
      });
    });
  });

  return true;
}