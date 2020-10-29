import { src, dest } from 'gulp';
import rename from 'gulp-rename';
import path from 'path';
import fs from 'fs';
// import prettier from 'prettier';
import blessed from 'neo-blessed';
import fg from 'fast-glob';
import { isFunction, each } from 'lodash';
import { clean as cleanFn, buildWebpack } from './';
// import named from 'vinyl-named';
// import { create } from 'browser-sync';
import { setName } from './lib/setName';
import { watchAll, watch as watchFn } from './lib/watch';
import { lintTs } from './lib/lintTs';
import { readFile } from 'fs';

// const browserSync = create();

// browserSync.init({
// 	proxy: 'http://ubuntu-server',
// 	open: false,
// 	port: 9999,
// 	minify: false,
// 	injectChanges: true,
// 	reloadOnRestart: false,
// 	// files: [relativeToPlugin('./assets/**')],
// });

// const prettierConfig = prettier.resolveConfig.sync(path.resolve(__dirname), {});
// console.log(prettierConfig)
const DEFAULT_SCROLL_OPTIONS = {
	scrollable: true,
	input: true,
	alwaysScroll: true,
	scrollbar: {
		ch: ' ',
		inverse: true,
	},
	keys: true,
	vi: true,
	mouse: true,
};

class Dashboard {
	constructor({ output, ...options }) {
		const program = blessed.program();

		//return;

		// program.alternateBuffer();
		this.screen = blessed.screen({
			title: '[' + output.split('/').slice(-2).join('/') + ']',
			smartCSR: true,
			dockBorders: false,
			// tput: true,
			fullUnicode: true,
			autoPadding: true,
		});

		this.layoutBottom();
		this.layoutTop();

		this.screen.key(['escape', 'q', 'C-c'], () => {
			process.kill(process.pid, 'SIGINT');
		});

		this.screen.key('enter', (ch, key) => {
			//program.clear();
			this.screen.realloc();
			this.screen.render();
		});

		this.screen.render();
	}

	layoutBottom = () => {
		this.bottomBox = blessed.box({
			label: ' Linter ',
			padding: 1,
			width: '100%',
			height: '70%',
			left: '0%',
			top: '30%',
			border: {
				type: 'line',
			},
			style: {
				fg: -1,
				border: {
					fg: 'grey',
				},
			},
		});

		this.bottomText = blessed.log({
			...DEFAULT_SCROLL_OPTIONS,
			parent: this.bottomBox,
			tags: true,
			width: '100%-5',
		});

		this.screen.append(this.bottomBox);
	};

	layoutTop = () => {
		this.topBox = blessed.box({
			label: ' Webpack ',
			padding: 1,
			width: '100%',
			height: '30%',
			left: '0%',
			top: '0%',
			border: {
				type: 'line',
			},
			style: {
				fg: -1,
				border: {
					fg: 'grey',
				},
			},
		});

		this.topText = blessed.log({
			...DEFAULT_SCROLL_OPTIONS,
			parent: this.topBox,
			tags: true,
			width: '100%-5',
		});

		this.screen.append(this.topBox);
	};

	bottom = {
		setColor: (color) => {
			if (!this.bottomBox) {
				return;
			}
			this.bottomBox.style.border.fg = color || 'gray';
			this.screen.render();
		},
		log: (...messages) => {
			// this.bottomText.log(messages.join(''));
			// this.screen.render();
		},
		clear: () => {
			// this.bottomText.setContent('');
			// this.screen.render();
		},
		setContent: (content) => {
			if (!this.bottomText) {
				console.log(content);
				return;
			}
			this.bottomText.setContent(content);
			this.screen.render();
		},
		setTitle: (title) => {
			if (!this.bottomBox) {
				return;
			}
			this.bottomBox._label.setContent(' ' + title + ' ');
			//console.log(this.bottomBox._label);
			// .setContent(title);
			// this.screen.render();
		},
	};

	top = {
		setColor: (color) => {
			if (!this.topBox) {
				return;
			}
			this.topBox.style.border.fg = color || 'gray';
			this.screen.render();
		},
		log: (...messages) => {
			if (!this.topText) {
				console.log(messages.join(''));
				return;
			}
			this.topText.log(messages.join(''));
			this.screen.render();
		},
		clear: () => {
			if (!this.topText) {
				return;
			}
			this.topText.setContent('');
			this.screen.render();
		},
	};
}

export const dev = ({ entry, watch, output, clean, tsconfig }) => async () => {
	const dashboard = new Dashboard({ output });

	const buildWebpackTask = buildWebpack({
		entry,
		output,
		watch,
		screen: dashboard.top,
		isEnvProduction: false,
	});

	watchFn(watch, async () => {
		await buildWebpackTask();
		// browserSync.reload();
	});

	const lintTsTask = lintTs({ tsconfig, watch, screen: dashboard.bottom });

	if (clean) {
		await cleanFn(clean && isFunction(clean) ? clean() : output);
	}

	const entries = ['vendors', ...Object.keys(entry)];
	const jsFiles = entries.map((entryName) => path.resolve(output, `${entryName}.js`));
	const cssFiles = entries.map((entryName) => path.resolve(output, `${entryName}.css`));

	watchAll(output, async (fileName) => {
		if (jsFiles.includes(fileName)) {
			await setName(
				`Minify JS - ${path.basename(fileName)}`,
				() =>
					src(fileName)
						.pipe(rename((path) => (path.basename += '.min')))
						.pipe(dest(output)),
				dashboard.top.log,
			)();
		}
		if (cssFiles.includes(fileName)) {
			await setName(
				`Minify CSS - ${path.basename(fileName)}`,
				() =>
					src(fileName)
						.pipe(rename((path) => (path.basename += '.min')))
						.pipe(dest(output)),
				dashboard.top.log,
			)();
		}
	});

	// TODO: bs-html-injector or like https://www.browsersync.io/docs/recipes

	watchFn(path.resolve(watch, '**/*.{ts,tsx,js,jsx}'), async (files) => {
		// each(files, (fileName) => {
		// 	// console.log({fileName, da: fs.readFileSync(fileName)})
		// 	fs.writeFileSync(fileName,
		// 		prettier.format(fs.readFileSync(fileName, 'utf-8'), { ...prettierConfig, filepath: fileName }));
		// });

		await lintTsTask(files);
	});

	const files = await fg(path.resolve(watch, '**/*.{ts,tsx,js,jsx}'));

	await Promise.all([lintTsTask(files), buildWebpackTask()]);
};
