import config from 'eslint-config-react-app';

config.overrides[0].files.push('*.tsx');
config.overrides[0].files.push('*.ts');

module.exports = config;
// extends: resolve.sync('eslint-config-react-app', {
// 	basedir: path.resolve(__dirname, './../node_modules'),
// }),
