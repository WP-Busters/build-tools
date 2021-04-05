import ReactRefreshWebpackPlugin from '@pmmmwh/react-refresh-webpack-plugin';
import CssMinimizerPlugin from 'css-minimizer-webpack-plugin';
import ImageminPlugin from 'imagemin-webpack';
import { each, find } from 'lodash';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import path from 'path';
import TerserPlugin from 'terser-webpack-plugin';
import webpack from 'webpack';
import { WebpackManifestPlugin } from 'webpack-manifest-plugin';
const ESLintPlugin = require('eslint-webpack-plugin');

const checkHasJsxRuntime = ((path = '') => {
	try {
		require.resolve(path + 'react/jsx-runtime');
		return true;
	} catch (e) {
		return false;
	}
})();

class RuntimePublicPath {
	constructor(settings) {
		this._publicPath = settings.publicPath;
	}
	apply(compiler) {
		const _publicPath = this._publicPath;

		if (!_publicPath) {
			return;
		}

		const _name = 'RuntimePublicPath';

		function updatePublicPath(source) {
			var newSource = [];
			newSource.push(source);
			// newSource.push('(() => {');
			newSource.push(' __webpack_require__.p = ' + _publicPath + ';');
			// newSource.push(' __webpack_public_path__ = ' + _publicPath + ';');
			// newSource.push('})();');

			return newSource.join('\n');
		}

		compiler.hooks.thisCompilation.tap(_name, function (compilation) {
			compilation.mainTemplate.hooks.requireExtensions.tap(_name, function (source, chunk, hash) {
				return updatePublicPath(source);
			});
		});
	}
}

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

export default ({
	isEnvProduction,
	isEnvProductionProfile,
	entry,
	output,
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

	return {
		target: 'web',

		mode: isEnvProduction ? 'production' : 'development',

		bail: isEnvProduction,
		devtool: isEnvProduction ? false : 'cheap-module-source-map', //'cheap-module-source-map',

		resolve: {
			// modules: ['node_modules', path.resolve(watch, 'node_modules')],
			extensions: ['.tsx', '.ts', '.jsx', '.js', '.json'],
			alias: {
				...(usePreact
					? {
							react: 'preact/compat',
							'react-dom': 'preact/compat',
					  }
					: {}),

				process: require.resolve('process/browser'),
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
			filename: isEnvProduction ? '[name].[contenthash:8].js' : '[name].js',
			chunkFilename: isEnvProduction ? '[name].[contenthash:8].chunk.js' : '[name].chunk.js',
			publicPath: isEnvProduction ? '/' : `https://${host}:${port}/`,

			// Point sourcemap entries to original disk location (format as URL on Windows)
			devtoolModuleFilenameTemplate: isEnvProduction
				? (info) => path.relative(watch, info.absoluteResourcePath).replace(/\\/g, '/')
				: isEnvDevelopment &&
				  ((info) => path.resolve(info.absoluteResourcePath).replace(/\\/g, '/')),

			// this defaults to 'window', but by setting it to 'this' then
			// module chunks which are built will work in web workers as well.
			globalObject: 'this',
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
							test: [/\.(js|mjs|jsx|ts|tsx)$/],
							include: [path.resolve(watch), /node_modules\/react-popper/],
							// exclude: /node_modules/,
							use: [
								{
									loader: require.resolve('babel-loader'),
									options: {
										// customize: require.resolve('babel-preset-react-app/webpack-overrides'),

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
											require.resolve('@reatom/babel-plugin'),
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
							],
						},
						{
							test: [/\.css$/],
							exclude: /\.module\.css$/,
							use: getStyleLoaders({
								watch,
								isEnvDevelopment,
								isEnvProduction,
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
							test: [/\.postcss$/],
							use: getStyleLoaders({
								watch,
								isEnvDevelopment,
								isEnvProduction,
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
								cssOptions: {
									importLoaders: 1,
									sourceMap: isEnvDevelopment,
									// localsConvention: 'camelCase',
									modules: {
										mode: 'local',
										exportGlobals: true,
										//context: watch,
										localIdentName: isEnvDevelopment ? '[path][name]__[local]' : '[hash:base64]',
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
							use: getStyleLoaders({
								watch,
								isEnvDevelopment,
								isEnvProduction,
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
									},
								},

								preProcessor: 'sass-loader',
								preOptions: {
									implementation: require('sass'),
								},
							}),
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
									cssOptions: {
										importLoaders: 2,
										sourceMap: isEnvDevelopment,

										modules: {
											mode: 'local',
											exportGlobals: true,
											//context: watch,
											localIdentName: isEnvDevelopment ? '[path][name]__[local]' : '[hash:base64]',
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
										titleProp: true,
										svgo: false,
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
							exclude: [/\.(js|mjs|jsx|ts|tsx)$/, /\.html$/, /\.json$/],
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
			isEnvProduction &&
				new MiniCssExtractPlugin({
					filename: '[name].[contenthash:8].css',
					chunkFilename: '[name].[contenthash:8].chunk.css',
				}),

			new WebpackManifestPlugin({
				fileName: 'asset-manifest.json',
				generate: (seed, files, entrypoints) => {
					const data = {};

					each(entrypoints, (entrypoint, entry) => {
						if (data[entry] === undefined) {
							data[entry] = {};
						}

						each(entrypoint, (chunk) => {
							const file = find(files, (file) => file.path.endsWith(chunk));

							if (file) {
								data[entry][file.name] = chunk;
							}
						});
					});

					return data;
				},
			}),

			isEnvDevelopment && hot && new webpack.HotModuleReplacementPlugin(),

			isEnvDevelopment &&
				useReactRefresh &&
				new ReactRefreshWebpackPlugin({
					exclude: [/node_modules/],
					overlay: {
						// entry: require.resolve('@pmmmwh/react-refresh-webpack-plugin/client/ErrorOverlayEntry'),
						// module: require.resolve('@pmmmwh/react-refresh-webpack-plugin/overlay'),

						entry: require.resolve('./webpackHotDevClient'),
						// entry: require.resolve('react-dev-utils/webpackHotDevClient'),
						// The expected exports are slightly different from what the overlay exports,
						// so an interop is included here to enable feedback on module-level errors.
						// module: require.resolve('react-dev-utils/refreshOverlayInterop'),
						// Since we ship a custom dev client and overlay integration,
						// the bundled socket handling logic can be eliminated.
						// sockIntegration: false,
						sockIntegration: 'wds',
						sockHost: host,
						sockPort: port,
					},
				}),

			new webpack.ProvidePlugin({
				process: require.resolve('process/browser'),
			}),

			new webpack.DefinePlugin({
				'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
				'process.env.WDS_SOCKET_HOST': JSON.stringify(host),
				'process.env.WDS_SOCKET_PORT': JSON.stringify(port),
				__RSUITE_CLASSNAME_PREFIX__: JSON.stringify('bust-'),
			}),

			new ImageminPlugin({
				bail: false, // Ignore errors on corrupted images
				cache: true,
				imageminOptions: {
					// Before using imagemin plugins make sure you have added them in `package.json` (`devDependencies`) and installed them

					// Lossless optimization with custom option
					// Feel free to experiment with options for better result for you
					plugins: [
						['gifsicle', { interlaced: true }],
						['jpegtran', { progressive: true }],
						['optipng', { optimizationLevel: 5 }],
						[
							'svgo',
							{
								plugins: [
									{
										removeViewBox: false,
									},
								],
							},
						],
					],
				},
			}),

			!disableESLintPlugin &&
				new ESLintPlugin({
					extensions: ['js', 'mjs', 'jsx', 'ts', 'tsx'],
					formatter: require.resolve('eslint-formatter-pretty'),
					eslintPath: require.resolve('eslint'),
					emitWarning: isEnvDevelopment,
					context: watch,
					failOnError: true,
					failOnWarning: false,
					// cache: true,
					// cacheLocation: path.resolve(projectRoot, 'node_modules', '.cache/.eslintcache'),
					// ESLint class options
					cwd: projectRoot,
					resolvePluginsRelativeTo: builderRoot,
					baseConfig: {
						extends: [require.resolve('./eslintrc.js')],
						// extends: [require.resolve('eslint-config-react-app/base')],
						rules: {
							...(!hasJsxRuntime && {
								'react/react-in-jsx-scope': 'error',
							}),
						},
					},
				}),

			isEnvProduction &&
				runtimePublicPath &&
				new RuntimePublicPath({
					publicPath: runtimePublicPath,
				}),
		].filter(Boolean),

		// Some libraries import Node modules but don't use them in the browser.
		// Tell Webpack to provide empty mocks for them so importing them works.

		// Turn off performance processing because we utilize
		// our own hints via the FileSizeReporter
		performance: false,

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
							ecma: 5,
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
					sourceMap: false,
				}),

				isEnvProduction &&
					new CssMinimizerPlugin({
						sourceMap: false,
						minimizerOptions: {
							preset: ['default', { minifyFontValues: { removeQuotes: false } }],
						},
					}),
			].filter(Boolean),
		},
	};
};
