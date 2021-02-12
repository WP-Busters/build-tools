export { clean } from '../src/clean';
export { eslintrc } from './eslintrc';
export { dev, prod, buildWebpack };
import { buildWebpack } from './buildWebpack';
import { dev } from './dev';
import { prod } from './prod';

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
