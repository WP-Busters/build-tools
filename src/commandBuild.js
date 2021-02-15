import chalk from 'chalk';
import del from 'del';
import webpack from 'webpack';
import { prepareConfig } from './prepareConfig';
const bfj = require('bfj');
const formatWebpackMessages = require('./formatWebpackMessages');
const FileSizeReporter = require('react-dev-utils/FileSizeReporter');
const printBuildError = require('react-dev-utils/printBuildError');

const measureFileSizesBeforeBuild = FileSizeReporter.measureFileSizesBeforeBuild;
const printFileSizesAfterBuild = FileSizeReporter.printFileSizesAfterBuild;

// These sizes are pretty large. We'll warn for bundles exceeding them.
const WARN_AFTER_BUNDLE_GZIP_SIZE = 512 * 1024;
const WARN_AFTER_CHUNK_GZIP_SIZE = 1024 * 1024;

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

			if (config.writeStatsJson) {
				return bfj
					.write(config.projectRoot + '/bundle-stats.json', stats.toJson())
					.then(() => resolve(resolveArgs))
					.catch((error) => reject(new Error(error)));
			}

			return resolve(resolveArgs);
		});
	});
}

export const commandBuild = async () => {
	const { config, webPackConfig } = prepareConfig({
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
				printFileSizesAfterBuild(
					stats,
					previousFileSizes,
					config.output,
					WARN_AFTER_BUNDLE_GZIP_SIZE,
					WARN_AFTER_CHUNK_GZIP_SIZE,
				);
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
