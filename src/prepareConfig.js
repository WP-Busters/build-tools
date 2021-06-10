import { mapValues } from 'lodash';
import { projectFile } from './utils';
import webpackConfig from './webpack.config.js';

export const prepareConfig = (c) => {
	const userConfig = require(projectFile('./builder.config.js'));

	const config = {
		port: 3030,
		host: 'localhost',
		entry: { index: './src/index.js' },
		output: './build',
		watch: './src',
		projectRoot: './',
		usePreact: false,
		writeStatsJson: false,
		isEnvProduction: false,
		isEnvProductionProfile: false,
		useReactRefresh: true,
		runtimePublicPath: false,
		hot: true,
		disableESLintPlugin: false,
		isGutenberg: false,
		...(c || {}),
		...(typeof userConfig === 'function' ? userConfig() : userConfig),
	};
	process.env.NODE_ENV = config.isEnvProduction ? 'production' : 'development';
	process.env.BABEL_ENV = config.isEnvProduction ? 'production' : 'development';
	// process.env.BROWSERSLIST = '> 1%, ie 11';

	config.output = projectFile(config.output);
	config.watch = projectFile(config.watch);
	config.projectRoot = projectFile(config.projectRoot);
	config.builderRoot = __dirname;
	config.entry = mapValues(config.entry, (p) => projectFile(p));

	if (config.isEnvProduction) {
		config.useReactRefresh = false;
	}

	if (config.isGutenberg) {
		config.usePreact = false;
		config.useReactRefresh = false;
	}

	const webPackConfig = webpackConfig(config);
	return { webPackConfig, config };
};
