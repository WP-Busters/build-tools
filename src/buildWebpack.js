import webpackConfig from './webpack.config';
import webpack from 'webpack';

// const SpeedMeasurePlugin = require('speed-measure-webpack-plugin');
// const smp = new SpeedMeasurePlugin();

export const buildWebpack = ({ entry, output, watch, watchMode, screen, isEnvProduction }) => {
	let compiler = null;

	const log = screen && screen.log ? screen.log : console.log;
	const setColor = screen && screen.setColor ? screen.setColor : () => {};
	const clearLog = screen && screen.clear ? screen.clear : () => {};

	return () => {
		// clearLog();
		// setColor('grey');

		return new Promise((resolve, reject) => {
			if (compiler === null) {
				// smp.wrap(
				const config = {
					...webpackConfig({ entry, output, watch, isEnvProduction }),
				};
				// console.log(config)
				compiler = webpack(config);
			}

			const cb = (err, stats) => {
				if (err) {
					console.error(err.stack || err);
					if (err.details) {
						console.error(err.details);
					}

					reject();

					return;
				}

				log(
					stats.toString({
						assets: isEnvProduction,
						hash: false,
						version: false,
						modules: false,
						children: false,
						chunkModules: false,
						chunks: false, // Makes the build much quieter
						colors: true, // Shows colors in the console
					}),
				);

				resolve();
			};

			if (watchMode) {
				compiler.watch(
					{
						ignored: /node_modules/,
					},
					cb,
				);
			} else {
				compiler.run(cb);
			}
		});
	};
};
