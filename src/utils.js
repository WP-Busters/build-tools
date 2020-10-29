import path from 'path';

const cwd = process.cwd();

export const projectFile = (file) => (path.isAbsolute(file) ? file : path.resolve(cwd, file));
