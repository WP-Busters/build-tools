import chalk from 'chalk';
import cors from 'cors';
import del from 'del';
import webpack from 'webpack';
import WebpackDevServer from 'webpack-dev-server';
import { prepareConfig } from './prepareConfig';
import { clearConsole } from './utils';
const errorOverlayMiddleware = require('react-dev-utils/errorOverlayMiddleware');
const formatWebpackMessages = require('./formatWebpackMessages');

const createComplier = (config) => {
	// "Compiler" is a low-level interface to webpack.
	// It lets us listen to some events and provide our own custom messages.
	let compiler;
	try {
		compiler = webpack(config);
	} catch (err) {
		console.log(chalk.red('Failed to compile.'));
		console.log();
		console.log(err.message || err);
		console.log();
		process.exit(1);
	}

	// "invalid" event fires when you have changed a file, and webpack is
	// recompiling a bundle. WebpackDevServer takes care to pause serving the
	// bundle, so if you refresh, it'll wait instead of serving the old one.
	// "invalid" is short for "bundle invalidated", it doesn't imply any errors.
	compiler.hooks.invalid.tap('invalid', () => {
		clearConsole();

		console.log('Compiling...');
	});

	// "done" event fires when webpack has finished recompiling the bundle.
	// Whether or not you have warnings or errors, you will get this event.
	compiler.hooks.done.tap('done', async (stats) => {
		clearConsole();

		// We have switched off the default webpack output in WebpackDevServer
		// options so we are going to "massage" the warnings and errors and present
		// them in a readable focused way.
		// We only construct the warnings and errors for speed:
		// https://github.com/facebook/create-react-app/issues/4492#issuecomment-421959548
		const statsData = stats.toJson({
			all: false,
			warnings: true,
			errors: true,
		});

		const messages = formatWebpackMessages(statsData);
		const isSuccessful = !messages.errors.length && !messages.warnings.length;
		if (isSuccessful) {
			console.log(chalk.green('Compiled successfully!'));
		}

		// If errors exist, only show errors.
		if (messages.errors.length) {
			// Only keep the first error. Others are often indicative
			// of the same problem, but confuse the reader with noise.
			if (messages.errors.length > 1) {
				messages.errors.length = 1;
			}
			console.log(chalk.red('Failed to compile.\n'));
			console.log(messages.errors.join('\n\n'));
			return;
		}

		// Show warnings if no errors were found.
		if (messages.warnings.length) {
			console.log(chalk.yellow('Compiled with warnings.\n'));
			console.log(messages.warnings.join('\n\n'));
		}
	});

	return compiler;
};

export const commandWatch = async () => {
	process.env.NODE_ENV = 'development';

	const { config, webPackConfig } = prepareConfig({
		isEnvProduction: false,
		// useReactRefresh: true,
	});

	//webPackConfig.entry = mapValues(webPackConfig.entry, (p) => [require.resolve('react-refresh/runtime'), p]);

	await del([config.output]);

	const compiler = createComplier(webPackConfig);
	const serverConfig = {
		writeToDisk: (filePath) => {
			return /.*(?<!hot-update)\.(css|js|gif|jpe?g|png|txt|json)(\.map)?$/.test(filePath);
		},
		disableHostCheck: true,
		compress: true,
		hot: config.hot,

		sockHost: config.host,
		sockPort: config.port,

		contentBase: config.output,
		transportMode: 'ws',
		injectClient: false,
		historyApiFallback: true,
		quiet: true,

		https: {
			cert: '/Users/dk/Library/Application Support/mkcert/_wildcard.wp.loc+4.pem',
			key: '/Users/dk/Library/Application Support/mkcert/_wildcard.wp.loc+4-key.pem',
		},
		host: config.host,
		overlay: false,
		clientLogLevel: 'none',
		watchOptions: {
			ignored: /node_modules|.astroturf/,
		},

		before(app, server) {
			app.use(cors());
			// Keep `evalSourceMapMiddleware` and `errorOverlayMiddleware`
			// middlewares before `redirectServedPath` otherwise will not have any effect
			// This lets us fetch source contents from webpack for the error overlay
			// app.use(evalSourceMapMiddleware(server));
			// This lets us open files from the runtime error overlay.
			app.use(errorOverlayMiddleware());
		},
	};

	const devServer = new WebpackDevServer(compiler, serverConfig);
	devServer.listen(config.port, config.host, (err) => {
		if (err) {
			return console.log(err);
		}

		// 	clearConsole();

		console.log(chalk.cyan('Starting the development server...\n'));
	});

	['SIGINT', 'SIGTERM'].forEach(function (sig) {
		process.on(sig, function () {
			devServer.close();
			process.exit();
		});
	});
};
