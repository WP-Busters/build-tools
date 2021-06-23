import webpack from 'webpack';

const WORDPRESS_NAMESPACE = '@wordpress/';
function camelCaseDash(string) {
	return string.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

export class WpCustomDependencyExtractionWebpackPlugin {
	constructor() {
		/*
		 * Track requests that are externalized.
		 *
		 * Because we don't have a closed set of dependencies, we need to track what has
		 * been externalized so we can recognize them in a later phase when the dependency
		 * lists are generated.
		 */
		this.externalizedDeps = new Set();

		// Offload externalization work to the ExternalsPlugin.
		this.externalsPlugin = new webpack.ExternalsPlugin('window', this.externalizeWpDeps.bind(this));
	}

	externalizeWpDeps(_context, request, callback) {
		let externalRequest;

		// Cascade to default if unhandled and enabled
		if (typeof externalRequest === 'undefined') {
			if (['@wordpress/icons', '@wordpress/interface'].includes(request)) {
				return undefined;
			}

			if (request.startsWith(WORDPRESS_NAMESPACE)) {
				externalRequest = ['wp', camelCaseDash(request.substring(WORDPRESS_NAMESPACE.length))];
			}
		}

		if (externalRequest) {
			this.externalizedDeps.add(request);

			return callback(null, externalRequest);
		}

		return callback();
	}

	// stringify(asset) {
	// 	return `<?php return ${json2php(JSON.parse(JSON.stringify(asset)))};`;
	// }

	apply(compiler) {
		this.externalsPlugin.apply(compiler);

		const pluginName = WpCustomDependencyExtractionWebpackPlugin.name;
		const { webpack } = compiler;
		const { RawSource } = webpack.sources;

		compiler.hooks.emit.tap(pluginName, (compilation) => {
			const manifest = {};

			for (const [entrypointName, entrypoint] of compilation.entrypoints.entries()) {
				const entrypointExternalizedWpDeps = new Set();

				const processModule = ({ userRequest }) => {
					if (this.externalizedDeps.has(userRequest)) {
						let scriptDependency = null;
						if (userRequest.startsWith(WORDPRESS_NAMESPACE)) {
							scriptDependency = 'wp-' + userRequest.substring(WORDPRESS_NAMESPACE.length);
						}
						entrypointExternalizedWpDeps.add(scriptDependency);
					}
				};

				compilation.entrypoints.get(entrypointName).chunks.forEach((chunk) => {
					compilation.chunkGraph.getChunkModules(chunk).forEach((chunkModule) => {
						processModule(chunkModule);

						if (chunkModule.modules) {
							for (const concatModule of chunkModule.modules) {
								processModule(concatModule);
							}
						}
					});
				});

				const runtimeChunk = entrypoint.getRuntimeChunk();

				const assetData = {
					dependencies: Array.from(entrypointExternalizedWpDeps).sort(),
					files: Array.from(runtimeChunk.files).filter(
						file => {
							const asset = compilation.getAsset(file);
							if ( asset?.info.hotModuleReplacement ) {
								return false;
							}
			
							return true;
						},
					),
					// version: runtimeChunk.hash,
				};

				// const assetString = JSON.stringify(assetData); // this.stringify(assetData);
				// const assetFilename = runtimeChunk.name + '.json';

				manifest[entrypointName] = assetData;

				// const path = compilation.getPath(assetFilename, {
				// 	chunk: { name: 'asset-' + entrypointName },
				// 	filename: assetFilename,
				// });

				// compilation.emitAsset(path, new RawSource(assetString));
			}

			const assetFilename = 'asset-manifest.json';

			const path = compilation.getPath(assetFilename, {
				chunk: { name: 'asset-manifest' },
				filename: assetFilename,
			});
			compilation.emitAsset(path, new RawSource(JSON.stringify(manifest)));
		});
	}
}
