
import chalk from 'chalk';
import cors from 'cors';
import del from 'del';
import { mapValues } from 'lodash-es';
import { createRequire } from 'module';
import formatWebpackMessages from 'react-dev-utils/formatWebpackMessages.js';
import webpack from 'webpack';
import WebpackDevServer from 'webpack-dev-server';
import { prepareConfig } from './prepareConfig.js';
import { clearConsole } from './utils.js';


const require = createRequire(import.meta.url);

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
		const serializedStats = stats.toJson({
			all: false,
			warnings: true,
			errors: true,
		});

		// is due to react-dev-utils not yet being compatible with webpack 5. This
		// may be possible to remove (just passing the serialized stats object
		// directly into the format function) after a new release of react-dev-utils
		// has been made available.
		const messages = formatWebpackMessages({
			errors: serializedStats.errors?.map(e => (e.message ? e.message : e)),
			warnings: serializedStats.warnings?.map(e => (e.message ? e.message : e)),
		  });
		const isSuccessful = !messages.errors.length && !messages.warnings.length;
		if (isSuccessful) {
			console.log(chalk.green('\n\nCompiled successfully!'));
		}

		// If errors exist, only show errors.
		if (messages.errors.length) {
			// Only keep the first error. Others are often indicative
			// of the same problem, but confuse the reader with noise.
			if (messages.errors.length > 1) {
				messages.errors.length = 1;
			}
			console.log(chalk.red('\n\nFailed to compile.\n'));
			console.log(messages.errors.join('\n\n'));
			return;
		}

		// Show warnings if no errors were found.
		if (messages.warnings.length) {
			console.log(chalk.yellow('\n\nCompiled with warnings.\n'));
			console.log(messages.warnings.join('\n\n'));
		}
	});

	return compiler;
};

export const commandWatch = async () => {
	process.env.NODE_ENV = 'development';

	const { config, webPackConfig } = await prepareConfig({
		isEnvProduction: false,
		// useReactRefresh: true,
	});

	webPackConfig.entry = mapValues(webPackConfig.entry, (p) => [require.resolve('react-refresh/runtime'), p]);

	await del([config.output]);

	const compiler = createComplier(webPackConfig);
	const serverConfig = {
		host: config.host,
        port: config.port,
		static: false,
		
        devMiddleware: {
            stats: {
				children: false,
				all: false,
				entrypoints: true,
				warnings: false,
				errors: false,
				hash: false,
				timings: true,
				errorDetails: true,
				builtAt: true,
				
                colors: true,
                chunks: false,
                chunkModules: false,
            },
			writeToDisk: (filePath) => {
				return /.*(?<!hot-update)\.(css|js|gif|jpe?g|png|txt|json)(\.map)?$/.test(filePath);
			},
        },
		
        historyApiFallback: false,
        open: false,
		allowedHosts: "all",
		
		hot: config.hot ? 'only' : false,

		
		webSocketServer: "ws",
		
		server: {
			type: "https",
			options: {
				cert: '/Users/dk/Mine/sites/caddy-env/.mkcert/cert.pem',
				key: '/Users/dk/Mine/sites/caddy-env/.mkcert/key.pem',
			}
		},
		watchFiles: {
			options: {
				ignored: /node_modules|.astroturf/,
			}
		},
		
		client: {
			webSocketURL: {
				hostname: config.host,
				pathname: "/ws",
				port: config.port,
			},
			logging: "none",
			overlay: true,
			progress: true,
		  },
		
		  setupMiddlewares: (middlewares, devServer) => {
			if (!devServer) {
			  throw new Error('webpack-dev-server is not defined');
			}

			devServer.app.use(cors());
			
			return middlewares;
		}
	};

	const devServer = new WebpackDevServer(serverConfig, compiler);
	devServer.startCallback(() => {
		// 	clearConsole();

		console.log(chalk.cyan('\n\nStarting the development server...'));
	});

	['SIGINT', 'SIGTERM'].forEach(function (sig) {
		process.on(sig, function () {
			devServer.close();
			process.exit();
		});
	});
};
