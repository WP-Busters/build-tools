import ReactRefreshWebpackPlugin from '@pmmmwh/react-refresh-webpack-plugin';
import StatoscopeWebpackPluginImport from '@statoscope/webpack-plugin';
import { CleanWebpackPlugin } from 'clean-webpack-plugin';
import CssMinimizerPlugin from 'css-minimizer-webpack-plugin';
import ESLintPlugin from 'eslint-webpack-plugin';
import ImageMinimizerPlugin from 'image-minimizer-webpack-plugin';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import { createRequire } from 'module';
import path from 'path';
import SpeedMeasurePlugin from 'speed-measure-webpack-plugin';
import TerserPlugin from 'terser-webpack-plugin';
import webpack from 'webpack';
import RemoveEmptyScriptsPlugin from 'webpack-remove-empty-scripts';
import { WpCustomDependencyExtractionWebpackPlugin } from './WpCustomDependencyExtractionWebpackPlugin.js';

const require = createRequire(import.meta.url);

const StatoscopeWebpackPlugin = StatoscopeWebpackPluginImport.default


/**
 * Gets a unique identifier for the webpack build to avoid multiple webpack
 * runtimes to conflict when using globals.
 * This is polyfill and it is based on the default webpack 5 implementation.
 *
 * @see https://github.com/webpack/webpack/blob/bbb16e7af2eddba4cd77ca739904c2aa238a2b7b/lib/config/defaults.js#L374-L376
 *
 * @return {string} The generated identifier.
 */
const getJsonpFunctionIdentifier = (name) => {
	const jsonpFunction = 'webpack5';
	if (typeof name !== 'string' || !name) {
		return jsonpFunction;
	}
	const IDENTIFIER_NAME_REPLACE_REGEX = /^([^a-zA-Z$_])/;
	const IDENTIFIER_ALPHA_NUMERIC_NAME_REPLACE_REGEX = /[^a-zA-Z0-9$]+/g;

	return (
		jsonpFunction +
		name
			.replace(IDENTIFIER_NAME_REPLACE_REGEX, '_$1')
			.replace(IDENTIFIER_ALPHA_NUMERIC_NAME_REPLACE_REGEX, '_')
	);
};

const checkHasJsxRuntime = ((path = '') => {
	try {
		require.resolve(path + 'react/jsx-runtime');
		return true;
	} catch (e) {
		return false;
	}
})();

const getStyleLoaders = ({
	isEnvDevelopment,
	cssOptions,
	preProcessor,
	postCssPlugins = [],
	preOptions,
	watch,
}) => {
	const loaders = [
		isEnvDevelopment && {
			loader: require.resolve('style-loader'),
			options: {
				esModule: true,
			},
		},
		!isEnvDevelopment && {
			loader: MiniCssExtractPlugin.loader,
			options: {
				esModule: true,
			},
		},
		{
			loader: require.resolve('css-loader'),
			options: cssOptions,
		},
		{
			// Options for PostCSS as we reference these options twice
			// Adds vendor prefixing based on your specified browser support in
			// package.json
			loader: require.resolve('postcss-loader'),
			options: {
				postcssOptions: {
					config: false,
					// Necessary for external CSS imports to work
					// https://github.com/facebook/create-react-app/issues/2677
					ident: 'postcss',
					plugins: (() => {
						const p = [
							require('postcss-nested'),
							require('postcss-atroot')(),
							require('postcss-move-props-to-bg-image-query'), // svg-transform-loader
							require('postcss-flexbugs-fixes'),
							require('postcss-preset-env')({
								autoprefixer: {
									flexbox: 'no-2009',
								},
								stage: 3,
							}),
							require('postcss-short'),
							require('postcss-hexrgba'),
							// Adds PostCSS Normalize as the reset css with default options,
							// so that it honors browserslist config in package.json
							// which in turn let's users customize the target behavior as per their needs.
							require('postcss-normalize')(),
							...postCssPlugins,
						];
						// console.log(p);
						return p;
					})(),
				},
				sourceMap: isEnvDevelopment,
			},
		},
	].filter(Boolean);

	if (preProcessor) {
		loaders.push(
			{
				loader: require.resolve('resolve-url-loader'),
				options: {
					sourceMap: isEnvDevelopment,
					root: watch,
				},
			},
			{
				loader: require.resolve(preProcessor),
				options: {
					sourceMap: isEnvDevelopment,
					...(preOptions || {}),
				},
			},
		);
	}

	return loaders;
};

const getBabelLoader = ({ isEnvDevelopment, projectRoot, isEnvProduction, useReactRefresh, hasJsxRuntime }) => [
	{
		loader: require.resolve('babel-loader'),
		options: {
			// customize: require.resolve('babel-preset-react-app/webpack-overrides'),
			// cacheDirectory: path.resolve(projectRoot, 'node_modules', '.cache_custom/js'),
			// cacheIdentifier: isEnvProduction ? 'prod' : 'dev',

			babelrc: false,
			configFile: false,

			presets: [
				// [
				// 	require.resolve('@babel/preset-env'),
				// 	{
				// 		configPath: __dirname,
				// 		debug: true,
				// 		targets: {
				// 			browsers: ['> 1%', 'last 2 versions', 'IE 11'],
				// 		},
				// 		modules: false,
				// 	},
				// ],
				[
					require.resolve('babel-preset-react-app'),
					{
						runtime: hasJsxRuntime ? 'automatic' : 'classic',
					},
				],
			],

			plugins: [
				//require.resolve('@babel/plugin-transform-modules-commonjs'),
				// require.resolve('@reatom/babel-plugin'),
				// require.resolve('babel-plugin-styled-components'),
				[
					require.resolve('babel-plugin-transform-imports'),
					{
						lodash: {
							transform: 'lodash/${member}',
							preventFullImport: true,
						},
						['react-use']: {
							transform: 'react-use/lib/${member}',
							preventFullImport: true,
						},
						['react-transition-group']: {
							transform: 'react-transition-group/esm/${member}',
							preventFullImport: true,
						},
						['@popperjs/core']: {
							transform: '@popperjs/core/lib/popper-lite',
							skipDefaultConversion: true,
							preventFullImport: true,
						},
						['react-popper']: {
							transform: 'react-popper/lib/esm/${member}',
							skipDefaultConversion: true,
							preventFullImport: true,
						},
						rsuite: {
							transform: 'rsuite/lib/${member}',
							preventFullImport: true,
						},
						['lodash-es']: {
							transform: 'lodash/${member}',
							preventFullImport: true,
						},
					},
				],
				[
					require.resolve('@babel/plugin-transform-spread'),
					{
						loose: true,
					},
				],
				isEnvDevelopment && useReactRefresh && require.resolve('react-refresh/babel'),
			].filter(Boolean),

			// This is a feature of `babel-loader` for webpack (not Babel itself).
			// It enables caching results in ./node_modules/.cache/babel-loader/
			// directory for faster rebuilds.
			cacheDirectory: true,
			cacheCompression: false,
			compact: isEnvProduction,
		},
	},
	{
		loader: require.resolve('astroturf/loader'),
		options: {
			extension: '.astroturf',
			// writeFiles: true,
			// getFileName(hostFilePath, pluginsOptions) {
			// 	// const basepath = join(
			// 	// 	dirname(hostFilePath),
			// 	// 	basename(hostFilePath, extname(hostFilePath)),
			// 	// );
			// 	const basepath =
			// 		'/Users/dk/Mine/sites/wp-image-directory3/email-builder/client/';
			// 	return `${basepath}__extracted_style.astroturf`;
			// },
		},
	},
];

export default ({
	isEnvProduction,
	isEnvProductionProfile,
	entry,
	output,
	packageJson,
	postCssPlugins,
	writeStatsJson,
	watch,
	useReactRefresh,
	host,
	port,
	builderRoot,
	projectRoot,
	disableESLintPlugin,
	runtimePublicPath,
	usePreact,
	hot,
}) => {
	const isEnvDevelopment = !isEnvProduction;
	const hasJsxRuntime = () => checkHasJsxRuntime(projectRoot + '/');

	let filename = isEnvProduction ? '[name].[contenthash:8].js' : '[name].[contenthash:4].js';

	const speadMeaurePlugin = false;

	const smp = speadMeaurePlugin ? new SpeedMeasurePlugin() : { wrap: (e) => e };

	return smp.wrap({
		target: ['web', 'es2016'],

		mode: isEnvProduction ? 'production' : 'development',

		bail: isEnvProduction,
		devtool: isEnvProduction ? false : 'cheap-module-source-map', //'cheap-module-source-map',

		resolve: {
			modules: ['node_modules', path.resolve(watch, 'node_modules')],
			extensions: ['.tsx', '.ts', '.jsx', '.mjs', '.cjs', '.js', '.json'],
			alias: {
				...(usePreact
					? {
							react: 'preact/compat',
							'react-dom': 'preact/compat',
							scheduler: false,
					  }
					: {}),

				process: require.resolve('process/browser'),
				'tslib': require.resolve('tslib'),
				// '@babel/runtime': require.resolve('@babel/runtime'),
				'react-fast-compare': require.resolve('fast-deep-equal'),
				...(isEnvProductionProfile && {
					'react-dom$': 'react-dom/profiling',
					'scheduler/tracing': 'scheduler/tracing-profiling',
				}),
			},
		},

		entry: entry,
		output: {
			path: output,
			// Add /* filename */ comments to generated require()s in the output.
			pathinfo: isEnvDevelopment,
			filename,
			chunkFilename: isEnvProduction
				? '[name].[contenthash:8].chunk.js'
				: '[name].[contenthash:4].chunk.js',
			publicPath: isEnvProduction ? '/' : `https://${host}:${port}/`,

			// Point sourcemap entries to original disk location (format as URL on Windows)
			devtoolModuleFilenameTemplate: isEnvProduction
				? (info) => path.relative(watch, info.absoluteResourcePath).replace(/\\/g, '/')
				: isEnvDevelopment &&
				  ((info) => path.resolve(info.absoluteResourcePath).replace(/\\/g, '/')),

			// Prevents conflicts when multiple webpack runtimes (from different apps)
			// are used on the same page.
			// @see https://github.com/WordPress/gutenberg/issues/23607
			uniqueName: getJsonpFunctionIdentifier(packageJson.name),
		},

		externals: {
			jquery: 'jQuery',
			backbone: 'Backbone',
		},

		module: {
			rules: [
				{
					oneOf: [
						{
							test: [/\.exec\.js$/],
							exclude: /(node_modules)/,
							use: [require.resolve('script-loader')],
						},
						{
							test: [/\.(js|mjs|cjs|jsx|ts|tsx)$/],
							include: [
								path.resolve(watch),
								/node_modules\/react-popper/,
								/node_modules\/.+\.(jsx|ts|tsx)$/,
							],
							// exclude: /node_modules/,
							use: getBabelLoader({
								isEnvProduction,
								isEnvDevelopment,
								useReactRefresh,
								hasJsxRuntime,
								projectRoot,
							}),
						},
						{
							test: [/\.css$/],
							exclude: /\.module\.css$/,
							use: getStyleLoaders({
								watch,
								isEnvDevelopment,
								isEnvProduction,
								postCssPlugins,
								cssOptions: {
									importLoaders: 1,
									styledTag: 'styledAstro',
									sourceMap: isEnvDevelopment,
								},
							}),
							// Don't consider CSS imports dead code even if the
							// containing package claims to have no side effects.
							// Remove this when webpack adds a warning or an error for this.
							// See https://github.com/webpack/webpack/issues/6571
							sideEffects: true,
						},

						{
							test: [/\.(post|p)css$/],
							use: getStyleLoaders({
								watch,
								isEnvDevelopment,
								isEnvProduction,
								postCssPlugins,
								cssOptions: {
									importLoaders: 2,
									sourceMap: isEnvDevelopment,
								},
							}),
							// Don't consider CSS imports dead code even if the
							// containing package claims to have no side effects.
							// Remove this when webpack adds a warning or an error for this.
							// See https://github.com/webpack/webpack/issues/6571
							sideEffects: true,
						},

						{
							test: [/\.less$/],
							exclude: /\.module\.less$/,
							use: [
								...getStyleLoaders({
									watch,
									isEnvDevelopment,
									isEnvProduction,
									postCssPlugins,
									cssOptions: {
										importLoaders: 2,
										sourceMap: isEnvDevelopment,
									},
									preProcessor: 'less-loader',
									// preOptions: { javascriptEnabled: true },
									preOptions: { lessOptions: { javascriptEnabled: true } },
								}),
							],
							// Don't consider CSS imports dead code even if the
							// containing package claims to have no side effects.
							// Remove this when webpack adds a warning or an error for this.
							// See https://github.com/webpack/webpack/issues/6571
							sideEffects: true,
						},

						{
							test: [/\.scss$/],
							exclude: /\.module\.scss$/,
							use: [
								...getStyleLoaders({
									watch,
									isEnvDevelopment,
									isEnvProduction,
									postCssPlugins,
									cssOptions: {
										importLoaders: 2,
										sourceMap: isEnvDevelopment,
									},
									preProcessor: 'sass-loader',
									preOptions: {
										implementation: require('sass'),
									},
								}),
							],
							// Don't consider CSS imports dead code even if the
							// containing package claims to have no side effects.
							// Remove this when webpack adds a warning or an error for this.
							// See https://github.com/webpack/webpack/issues/6571
							sideEffects: true,
						},

						{
							test: [/\.module\.css$/],
							use: getStyleLoaders({
								watch,
								isEnvDevelopment,
								isEnvProduction,
								postCssPlugins,
								cssOptions: {
									importLoaders: 1,
									sourceMap: isEnvDevelopment,
									// localsConvention: 'camelCase',
									modules: {
										mode: 'local',
										exportGlobals: true,
										//context: watch,
										localIdentName: isEnvDevelopment ? '[path][name]__[local]' : '[hash:base64]',
										localIdentContext: watch,
									},
								},
							}),
							// Don't consider CSS imports dead code even if the
							// containing package claims to have no side effects.
							// Remove this when webpack adds a warning or an error for this.
							// See https://github.com/webpack/webpack/issues/6571
							sideEffects: true,
						},

						{
							test: [/\.astroturf$/],
							use: [
								...getStyleLoaders({
									watch,
									isEnvDevelopment,
									isEnvProduction,
									postCssPlugins,
									cssOptions: {
										importLoaders: 1,
										sourceMap: isEnvDevelopment,

										modules: {
											compileType: 'module',
											// compileType: 'icss',
											mode: 'local',
											exportGlobals: true,
											// //context: watch,
											localIdentName: isEnvDevelopment ? '[path][name]__[local]' : '[hash:base64]',
											localIdentContext: watch,
										},
									},

									preProcessor: 'sass-loader',
									preOptions: {
										implementation: require('sass'),
									},
								}),
							],
							// Don't consider CSS imports dead code even if the
							// containing package claims to have no side effects.
							// Remove this when webpack adds a warning or an error for this.
							// See https://github.com/webpack/webpack/issues/6571
							sideEffects: true,
						},

						{
							test: [/\.module\.less$/],
							use: [
								...getStyleLoaders({
									watch,
									isEnvDevelopment,
									isEnvProduction,
									postCssPlugins,
									cssOptions: {
										importLoaders: 2,
										sourceMap: isEnvDevelopment,

										modules: {
											mode: 'local',
											exportGlobals: true,
											//context: watch,
											localIdentName: isEnvDevelopment ? '[path][name]__[local]' : '[hash:base64]',
											localIdentContext: watch,
										},
									},
									preProcessor: 'less-loader',

									preOptions: { lessOptions: { javascriptEnabled: true } },
								}),
							],
							// Don't consider CSS imports dead code even if the
							// containing package claims to have no side effects.
							// Remove this when webpack adds a warning or an error for this.
							// See https://github.com/webpack/webpack/issues/6571
							sideEffects: true,
						},
						{
							test: [/\.svg$/],
							use: [
								{
									loader: require.resolve('@svgr/webpack'),
									options: {
										prettier: false,
										svgo: false,
										svgoConfig: {
											plugins: [{ removeViewBox: false }],
										},
										titleProp: true,
										ref: true,
									},
								},
								require.resolve('url-loader'),
							],
						},
						{
							test: [/\.svg(\?.*)?$/], // match img.svg and img.svg?param=value
							issuer: [/.less?$/],
							use: [
								require.resolve('url-loader'), // or file-loader or svg-url-loader
								require.resolve('svg-transform-loader'),
							],
						},

						{
							loader: require.resolve('file-loader'),
							// Exclude `js` files to keep "css" loader working as it injects
							// its runtime that would otherwise be processed through "file" loader.
							// Also exclude `html` and `json` extensions so they get processed
							// by webpacks internal loaders.
							exclude: [/\.(js|mjs|cjs|jsx|ts|tsx)$/, /\.html$/, /\.json$/],
							options: {
								name: 'assets/[name].[contenthash:8].[ext]',
							},
						},

						// {
						// 	test: /\.(js|mjs|jsx|ts|tsx)$/,
						// 	include: path.resolve(watch),
						// 	exclude: /(node_modules|bower_components)/,
						// 	use: [
						// 		{
						// 			loader: require.resolve('astroturf/loader'),
						// 			options: { extension: '.module.scss' },
						// 		},
						// 	],
						// },
					],
				},
			],
		},

		plugins: [
			new RemoveEmptyScriptsPlugin(),
			new webpack.ProgressPlugin(),
			new CleanWebpackPlugin(),
			
			isEnvProduction &&
				new MiniCssExtractPlugin({
					filename: '[name].[contenthash:8].css',
					chunkFilename: '[name].[contenthash:8].chunk.css',
					ignoreOrder: true // Enable to remove warnings about conflicting order
				}),

			new WpCustomDependencyExtractionWebpackPlugin(),

			writeStatsJson && new StatoscopeWebpackPlugin({
				saveStatsTo: projectRoot + '/bundle-stats.json',
				saveOnlyStats: true,
			}),

			isEnvDevelopment &&
				useReactRefresh &&
				new ReactRefreshWebpackPlugin({
					exclude: [/node_modules/],
					overlay: false,
				}),

			new webpack.ProvidePlugin({
				process: require.resolve('process/browser'),
			}),

			new webpack.DefinePlugin({
				'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
				'process.env.WDS_SOCKET_HOST': JSON.stringify(host),
				'process.env.WDS_SOCKET_PATH': JSON.stringify('/ws'),
				'process.env.WDS_SOCKET_PORT': JSON.stringify(port),
				__RSUITE_CLASSNAME_PREFIX__: JSON.stringify('bust-'),
			}),

			!disableESLintPlugin &&
				new ESLintPlugin({
					extensions: ['js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx'],
					formatter: require.resolve('react-dev-utils/eslintFormatter'),
					eslintPath: require.resolve('eslint'),
					emitWarning: isEnvDevelopment,
					context: watch,
					failOnError: true,
					failOnWarning: false,
					cache: true,
					// cacheDirectory: path.resolve(projectRoot, 'node_modules', '.cache_custom/eslintcache'),
					cacheLocation: path.resolve(projectRoot, 'node_modules', '.cache/.eslintcache'),
					// ESLint class options
					cwd: projectRoot,
					resolvePluginsRelativeTo: builderRoot,
					baseConfig: {
						extends: [require.resolve('./eslintrc.cjs')],
						// extends: [require.resolve('eslint-config-react-app/base')],
						rules: {
							...(!hasJsxRuntime && {
								'react/react-in-jsx-scope': 'error',
							}),
						},
					},
				}),

			// isEnvProduction &&
				// runtimePublicPath &&
				// new RuntimePublicPath({
				// 	publicPath: runtimePublicPath,
				// }),
		].filter(Boolean),

		// Some libraries import Node modules but don't use them in the browser.
		// Tell Webpack to provide empty mocks for them so importing them works.

		// Turn off performance processing because we utilize
		// our own hints via the FileSizeReporter
		performance: false,

		cache: {
			type: 'filesystem',
			store: 'pack',
    		allowCollectingMemory: true,
		  },

		infrastructureLogging: {
			level: 'none',
		},

		optimization: {
			minimize: isEnvProduction,

			minimizer: [
				// This is only used in production mode
				// false &&
				new TerserPlugin({
					parallel: true,
					terserOptions: {
						parse: {
							// We want terser to parse ecma 8 code. However, we don't want it
							// to apply any minification steps that turns valid ecma 5 code
							// into invalid ecma 5 code. This is why the 'compress' and 'output'
							// sections only apply transformations that are ecma 5 safe
							// https://github.com/facebook/create-react-app/pull/4234
							ecma: 8,
						},
						compress: {
							ecma: 2016,
							warnings: false,
							// Disabled because of an issue with Uglify breaking seemingly valid code:
							// https://github.com/facebook/create-react-app/issues/2376
							// Pending further investigation:
							// https://github.com/mishoo/UglifyJS2/issues/2011
							comparisons: false,
							// Disabled because of an issue with Terser breaking valid code:
							// https://github.com/facebook/create-react-app/issues/5250
							// Pending further investigation:
							// https://github.com/terser-js/terser/issues/120
							inline: 2,
						},
						mangle: {
							reserved: ['__', '_n', '_nx', '_x'],
							safari10: true,
						},
						// Added for profiling in devtools
						keep_classnames: isEnvProductionProfile,
						keep_fnames: isEnvProductionProfile,
						output: {
							ecma: 5,
							comments: false,
							// Turned on because emoji and regex is not minified properly using default
							// https://github.com/facebook/create-react-app/issues/2488
							ascii_only: true,
						},
					},
					extractComments: false,
				}),


				new ImageMinimizerPlugin({
					minimizer: {
						implementation: ImageMinimizerPlugin.imageminMinify,
						options: {
							plugins: [
								['gifsicle', { interlaced: true }],
								['jpegtran', { progressive: true }],
								['optipng', { optimizationLevel: 5 }],
								[
									'svgo',
									{
										plugins: [
											{ name: 'removeViewBox', active: false }, 
											{
												name: "addAttributesToSVGElement",
												params: {
													attributes: [{ xmlns: "http://www.w3.org/2000/svg" }],
												},
											}
										],
									},
								],
							],
						}
					},
				}),


				isEnvProduction &&
					new CssMinimizerPlugin({
						minimizerOptions: {
							preset: ['default', { minifyFontValues: { removeQuotes: false } }],
						},
					}),
			].filter(Boolean),
		},
	});
};
