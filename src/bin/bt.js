#!/usr/bin/env node

import path from "path";
import { fileURLToPath } from 'url';
import { cli } from '../cli.js';

Object.defineProperty(global, "__filename", {
  __proto__: null,
  get: () => fileURLToPath(import.meta.url),
});

Object.defineProperty(global, "__dirname", {
  __proto__: null,
  get: () => path.dirname(__filename),
});

cli(process.argv.slice(2), (c) => {
	console.log(c);
	process.exit();
});
