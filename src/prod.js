import { src, dest } from 'gulp';
import fs from 'fs';
import fg from 'fast-glob';
import path from 'path';
import { isFunction } from 'lodash';
import rename from 'gulp-rename';
import terser from 'gulp-terser';
// import gulpif from 'gulp-if';
import cleanCSS from 'gulp-clean-css';
import { terserOptions } from './lib/terserOptions';
import { clean as cleanFn, buildWebpack } from './';

import { setName } from './lib/setName';
import { lintTs } from './lib/lintTs';

export const prod = ({ entry, watch, output, clean, tsconfig }) => async () => {
	const buildWebpackTask = buildWebpack({ entry, watch, output, isEnvProduction: true });
	const lintTsTask = lintTs({ tsconfig, watch });

	if (clean) {
		await cleanFn(clean && isFunction(clean) ? clean() : output);
	}

	const files = await fg(path.resolve(watch, '**/*.{ts,tsx,js,jsx}'));
	await lintTsTask(files);

	await buildWebpackTask();

	const entries = ['vendors', ...Object.keys(entry)];
	await Promise.all([
		...entries.map((entryName) =>
			setName(`Minify JS - ${entryName}.js`, () =>
				src(path.resolve(output, `${entryName}.js`))
					.pipe(rename((path) => (path.basename += '.min')))
					.pipe(terser(terserOptions))
					.pipe(dest(output)),
			)(),
		),
		...entries.map((entryName) =>
			setName(`Minify CSS - ${entryName}.css`, () => {
				const filePath = path.resolve(output, `${entryName}.css`);

				if (fs.existsSync(filePath)) {
					return src(filePath)
						.pipe(rename((path) => (path.basename += '.min')))
						.pipe(cleanCSS({ compatibility: 'ie11' }))
						.pipe(dest(output));
				}
			})(),
		),
	]);
};
