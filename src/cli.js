import parseArgs from 'minimist';
import { commandBuild } from './commandBuild.js';
import { commandWatch } from './commandWatch.js';

export const cli = (argv, error) => {
	let args = parseArgs(argv, {
		// alias: {
		//   c: 'config',
		//   h: 'help',
		//   v: 'version',
		// },
		// boolean: ['help', 'version'],
	});

	let command = args._[0];

	if (command === 'watch') {
		commandWatch();
	} else if (command === 'build') {
		commandBuild();
	}
};
