export default {
	presets: [
		[
			'@babel/preset-env',
			{
				modules: false,

				targets: {
					esmodules: true,

					node: '14',
				},
			},
		],
	],
	plugins: ['@babel/plugin-proposal-class-properties'],
};
