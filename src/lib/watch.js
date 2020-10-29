import chokidar from 'chokidar';
import { each } from 'lodash';

export const watch = (mask, task, ready = false) => {
	let files = [];
	let timer;
	const waitTick = (cb) => {
		if (timer) {
			clearImmediate(timer);
		}
		timer = setImmediate(cb);
	};

	const enqueue = (path) => {
		files.push(path);

		return new Promise((resolve, reject) => {
			waitTick(async () => {
				try {
					await task(files);
				} catch (e) {
					reject(e);
				}

				files = [];
				resolve();
			});
		});
	};

	const watcher = chokidar.watch(mask);

	watcher
		.on('ready', async () => {
			if (ready) {
				const wdata = watcher.getWatched();
				const files = [];
				each(wdata, (a, p) => each(a, (f) => files.push(p + '/' + f)));
				ready(files);
			}
		})
		.on('change', async (path) => {
			try {
				await enqueue(path);
			} catch (e) {
				if (e) console.log(e.message);
			}
		});
};


export const watchAll = (mask, task, ready = false) => {
	const watcher = chokidar.watch(mask);

	watcher
		.on('all', async (event, path) => {
			try {
				await task(path);
			} catch (e) {
				if (e) console.log(e.message);
			}
		});
};
