export class RuntimePublicPath {
	constructor(settings) {
		this._publicPath = settings.publicPath;
	}
	apply(compiler) {
		const _publicPath = this._publicPath;


		const _name = 'RuntimePublicPath';

		function updatePublicPath(source) {
			var newSource = [];
			newSource.push(source);

			const fn = `
				var _publicPath = ${_publicPath ? JSON.stringify(_publicPath) : 'null'};
				var src;
				if(!_publicPath && document.currentScript && (src = document.currentScript.src)) {
					_publicPath = src.substring(0, src.lastIndexOf("/")) + '/';
				}

				__webpack_require__.p = _publicPath;
			`;
			newSource.push(fn);

			return newSource.join('\n');
		}

		compiler.hooks.thisCompilation.tap(_name, function (compilation) {
			compilation.mainTemplate.hooks.requireExtensions.tap(_name, function (source, chunk, hash) {
				return updatePublicPath(source);
			});
		});
	}
}
