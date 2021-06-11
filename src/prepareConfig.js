import { realpathSync } from 'fs';
import { mapValues } from 'lodash-es';
import { readPackageUpSync } from 'read-pkg-up';
import { projectFile } from './utils.js';
import webpackConfig from './webpack.config.js';

const getPackagePath = () => pkgPath;

const getPackageProp = (prop) => pkg && pkg[prop];

export const prepareConfig = async (c) => {
	const userConfig = (await import(projectFile('./builder.config.js'))).default;

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

	const { packageJson } = readPackageUpSync({
		cwd: realpathSync(config.projectRoot),
	});

	if (packageJson) {
		config.packageJson = packageJson;
	}

	if (config.isEnvProduction) {
		config.useReactRefresh = false;
	}

	const webPackConfig = webpackConfig(config);
	return { webPackConfig, config };
};
