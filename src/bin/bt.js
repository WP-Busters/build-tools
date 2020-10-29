#!/usr/bin/env node

import { cli } from './../cli';

cli(process.argv.slice(2), (c) => {
	console.log(c);
	process.exit();
});
