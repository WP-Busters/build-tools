import path from 'path';

const cwd = process.cwd();

export const projectFile = (file) => (path.isAbsolute(file) ? file : path.resolve(cwd, file));

export const clearConsole = () => {
	process.stdout.write(process.platform === 'win32' ? '\x1B[2J\x1B[0f' : '\x1B[2J\x1B[3J\x1B[H');
};
