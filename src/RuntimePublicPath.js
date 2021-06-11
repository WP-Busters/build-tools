export class RuntimePublicPath {
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
