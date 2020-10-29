import ReactRefreshWebpackPlugin from '@pmmmwh/react-refresh-webpack-plugin';
import ImageminPlugin from 'imagemin-webpack';
import { each, find } from 'lodash';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import path from 'path';
import postcssNormalize from 'postcss-normalize';
import webpack from 'webpack';
import ManifestPlugin from 'webpack-manifest-plugin';
const TerserPlugin = require('terser-webpack-plugin');
const OptimizeCSSAssetsPlugin = require('optimize-css-assets-webpack-plugin');
const postcssAtroot = require('postcss-atroot');
const postcssNested = require('postcss-nested');
const safePostCssParser = require('postcss-safe-parser');

const getStyleLoaders = ({
	isEnvDevelopment,
	cssOptions,
	preProcessor,
	postCssPlugins = [],
	preOptions,
	watch,
}) => {
	const loaders = [
		isEnvDevelopment && require.resolve('style-loader'),
		!isEnvDevelopment && {
			loader: MiniCssExtractPlugin.loader,
			options: {
				esModule: false,
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
				// Necessary for external CSS imports to work
				// https://github.com/facebook/create-react-app/issues/2677
				ident: 'postcss',
				plugins: () => {
					const p = [
						postcssNested(),
						postcssAtroot(),
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
						postcssNormalize(),

						...postCssPlugins,
					];

					return p;
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
}) => {
	const isEnvDevelopment = !isEnvProduction;

	return {
		target: 'web',

		mode: isEnvProduction ? 'production' : 'development',

		bail: isEnvProduction,
		devtool: isEnvProduction ? false : 'cheap-module-source-map', //'cheap-module-source-map',

		resolve: {
			// modules: ['node_modules', path.resolve(watch, 'node_modules')],
			extensions: ['.tsx', '.ts', '.jsx', '.js', '.json'],
			alias: {
				//fresh/runtime': require.resolve('react-refresh/runtime'), - do not work (
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
			// TODO: remove this when upgrading to webpack 5
			futureEmitAssets: true,
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
							test: /\.exec\.js$/,
							exclude: /(node_modules|bower_components)/,
							use: [require.resolve('script-loader')],
						},
						{
							test: /\.(js|mjs|jsx|ts|tsx)$/,
							include: path.resolve(watch),
							exclude: /(node_modules|bower_components)/,
							use: [
								{
									loader: require.resolve('babel-loader'),
									options: {
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
											require.resolve('babel-preset-react-app'),
										],

										plugins: [
											require.resolve('@babel/plugin-transform-modules-commonjs'),
											require.resolve('@reatom/babel-plugin'),
											// require.resolve('babel-plugin-styled-components'),
											[
												require.resolve('babel-plugin-transform-imports'),
												{
													lodash: {
														transform: 'lodash/${member}',
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
												require.resolve('babel-plugin-named-asset-import'),
												{
													loaderMap: {
														svg: {
															ReactComponent: '@svgr/webpack?-svgo,+titleProp,+ref![path]',
														},
													},
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
										extension: '.module.css',
									},
								},
							],
						},
						{
							test: /\.css$/,
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
							test: /\.postcss$/,
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
							test: /\.less$/,
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
							test: /\.scss$/,
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
							test: /\.module\.css$/,
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
							test: /\.module\.less$/,
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
							test: /\.svg(\?.*)?$/, // match img.svg and img.svg?param=value
							issuer: {
								test: /.less?$/,
							},
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
								name: 'assets/[name].[hash:8].[ext]',
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

			new ManifestPlugin({
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

			isEnvDevelopment && new webpack.HotModuleReplacementPlugin(),

			isEnvDevelopment &&
				useReactRefresh &&
				new ReactRefreshWebpackPlugin({
					overlay: {
						entry: require.resolve('react-dev-utils/webpackHotDevClient'),
						// The expected exports are slightly different from what the overlay exports,
						// so an interop is included here to enable feedback on module-level errors.
						// module: require.resolve('react-dev-utils/refreshOverlayInterop'),
						// Since we ship a custom dev client and overlay integration,
						// the bundled socket handling logic can be eliminated.
						sockIntegration: false,
						// sockHost: host,
						// sockPort: port,
					},
				}),

			new webpack.DefinePlugin({
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
		].filter(Boolean),

		// Some libraries import Node modules but don't use them in the browser.
		// Tell Webpack to provide empty mocks for them so importing them works.
		node: {
			module: 'empty',
			dgram: 'empty',
			dns: 'mock',
			fs: 'empty',
			http2: 'empty',
			net: 'empty',
			tls: 'empty',
			child_process: 'empty',
		},
		// Turn off performance processing because we utilize
		// our own hints via the FileSizeReporter
		performance: false,

		optimization: {
			minimize: isEnvProduction,

			splitChunks: {
				chunks: 'async',
				maxAsyncRequests: 6,
				maxInitialRequests: 4,
				cacheGroups: {
					commons: {
						test: /[\\/]node_modules[\\/]/,
						name: 'vendors',
						chunks: 'all',
					},
				},
			},

			minimizer: [
				// This is only used in production mode
				new TerserPlugin({
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
				// This is only used in production mode
				new OptimizeCSSAssetsPlugin({
					cssProcessorOptions: {
						parser: safePostCssParser,
						map: false,
					},
					cssProcessorPluginOptions: {
						preset: ['default', { minifyFontValues: { removeQuotes: false } }],
					},
				}),
			],
		},
	};
};
