#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { cli } from '../cli.js';

Object.defineProperty(global, '__dirname', {
	__proto__: null,
	get: () => fileURLToPath(import.meta.url),
});

cli(process.argv.slice(2), (c) => {
	console.log(c);
	process.exit();
});
