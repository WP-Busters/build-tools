export { eslintrc } from './eslintrc';
export { clean } from './clean';
import { dev } from './dev';
import { prod } from './prod';
import { buildWebpack } from './buildWebpack';
import { watch as watchFn } from './lib/watch';

export { dev, prod, buildWebpack };

export const build = (sett) => ({
	dev: dev(sett),
	prod: prod(sett),
});

export const webpack = (sett) => ({
	dev: () => {
		const { entry, output, watch } = sett;
		const buildWebpackTask = buildWebpack({
			entry,
			output,
			watch,
			isEnvProduction: false,
			watchMode: true,
		});

		// watchFn(watch, async () => {
		// 	console.log('Build...');
		// 	await buildWebpackTask();
		// 	// browserSync.reload();
		// });

		buildWebpackTask();
	},
	prod: prod(sett),
});
