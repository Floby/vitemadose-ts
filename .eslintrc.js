module.exports = {
	env: {
		es6: true,
		node: true,
		mocha: true
	},
	extends: [
		'standard',
		'plugin:chai-friendly/recommended',
		'plugin:@typescript-eslint/recommended'
	],
	globals: {
		Atomics: 'readonly',
		SharedArrayBuffer: 'readonly'
	},
	parser: '@typescript-eslint/parser',
	parserOptions: {
		ecmaVersion: 2020
	},
	plugins: [
		'@typescript-eslint',
		'mocha',
		'chai-friendly'
	],
	rules: {
		'no-process-env': 'error',
		indent: ['error', 'tab'],
		'no-tabs': 'off',
		'no-console': 'error',
		'mocha/no-exclusive-tests': 'error',
		'@typescript-eslint/no-namespace': 'off',
		'no-useless-constructor': 'off',
		'@typescript-eslint/no-useless-constructor': 'error',
		'no-use-before-define': 'off',
		'@typescript-eslint/no-use-before-define': ['error', {
			functions: false,
			classes: false,
			variables: true,
			allowNamedExports: true,
			ignoreTypeReferences: true
		}],
		'@typescript-eslint/no-unused-vars': ['error', {
			varsIgnorePattern: '^_',
			argsIgnorePattern: '^_'
		}]
	}
}
