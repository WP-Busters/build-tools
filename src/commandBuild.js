import chalk from 'chalk';
import del from 'del';
import {
	measureFileSizesBeforeBuild,
	printFileSizesAfterBuild
} from 'react-dev-utils/FileSizeReporter.js';
import printBuildError from 'react-dev-utils/printBuildError.js';
import webpack from 'webpack';
import formatWebpackMessages from './__formatWebpackMessages.cjs';
import { prepareConfig } from './prepareConfig.js';

function build(config, configW, previousFileSizes) {
	console.log('Creating an optimized production build...');

	const compiler = webpack(configW);

	return new Promise((resolve, reject) => {
		compiler.run((err, stats) => {
			let messages;
			if (err) {
				if (!err.message) {
					return reject(err);
				}

				let errMessage = err.message;

				// Add additional information for postcss errors
				if (Object.prototype.hasOwnProperty.call(err, 'postcssNode')) {
					errMessage += '\nCompileError: Begins at CSS selector ' + err['postcssNode'].selector;
				}

				messages = formatWebpackMessages({
					errors: [errMessage],
					warnings: [],
				});
			} else {
				messages = formatWebpackMessages(
					stats.toJson({ all: false, warnings: true, errors: true }),
				);
			}
			if (messages.errors.length) {
				// Only keep the first error. Others are often indicative
				// of the same problem, but confuse the reader with noise.
				if (messages.errors.length > 1) {
					messages.errors.length = 1;
				}
				return reject(new Error(messages.errors.join('\n\n')));
			}

			const resolveArgs = {
				stats,
				previousFileSizes,
				warnings: messages.warnings,
			};

			return resolve(resolveArgs);
		});
	});
}

export const commandBuild = async () => {
	const { config, webPackConfig } = await prepareConfig({
		isEnvProduction: true,
		// useReactRefresh: false,
	});

	const previousFileSizes = await measureFileSizesBeforeBuild(config.output);

	await del([config.output]);

	build(config, webPackConfig, previousFileSizes)
		.then(
			({ stats, previousFileSizes, warnings }) => {
				if (warnings.length) {
					console.log(chalk.yellow('Compiled with warnings.\n'));
					console.log(warnings.join('\n\n'));
				} else {
					console.log(chalk.green('Compiled successfully.\n'));
				}

				console.log('File sizes after gzip:\n');
				printFileSizesAfterBuild(stats, previousFileSizes, config.output, 512 * 1024, 1024 * 1024);
				console.log();
			},
			(err) => {
				console.log(chalk.red('Failed to compile.\n'));
				printBuildError(err);
				process.exit(1);
			},
		)
		.catch((err) => {
			if (err && err.message) {
				console.log(err.message);
			}
			process.exit(1);
		});
};
