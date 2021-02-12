import path from 'path';
import fs from 'fs';
import fg from 'fast-glob';
// import { throttle } from 'lodash';

// import chalk from 'chalk';
import resolve from 'resolve';
import pretty from './eslint-formatter-pretty';
import { perfMeasure } from './perfMeasure';
import { CLIEngine } from 'eslint';
import { Project } from 'ts-morph';

export const lintTs = ({ tsconfig, watch, screen }) => {
	const log = screen && screen.log ? screen.log : console.log;
	const setColor = screen && screen.setColor ? screen.setColor : () => {};
	const setContent = screen && screen.setContent ? screen.setContent : log;
	const setTitle = screen && screen.setTitle ? screen.setTitle : log;
	const clearLog = screen && screen.clear ? screen.clear : () => {};

	const eslintEngine = new CLIEngine({
		baseConfig: {
			extends: resolve.sync('eslint-config-react-app', {
				basedir: path.resolve('./node_modules'),
			}),
		},
	});

	const project = new Project({
		tsConfigFilePath: tsconfig,
		addFilesFromTsConfig: true,
	});

	// project.addExistingDirectory(relativeToPlugin('./src'));
	const program = project.getProgram();
	// project.addExistingSourceFiles(relativeToPlugin('./src/**/*.ts'));
	// project.addExistingSourceFiles(relativeToPlugin('./src/**/*.tsx'));

	const fileMap = new Map();

	const getEntry = (filePath) => {
		let entry = fileMap.get(filePath);

		if (!entry) {
			entry = {
				filePath,
				errorCount: 0,
				warningCount: 0,
				messages: [],
			};

			fileMap.set(filePath, entry);
		}

		return entry;
	};

	let eslintFinished = false;
	let tsFinished = false;
	let timeFromStart;

	const outputMessages = () => {
		const messages = Array.from(fileMap.values());
		const hasErrors = messages.length > 0;

		// setContent(messages.length > 0 ? pretty(messages) : '-');
		// setColor(messages.length > 0 ? 'red' : 'green');

		if (eslintFinished && tsFinished) {
			if (!hasErrors) {
				setContent('No errors');
				setColor('green');
			} else {
				setContent(pretty(messages));
				setColor('red');
			}
		} else {
			if (hasErrors) {
				setContent(pretty(messages));
				setColor('red');
			} else {
				setContent('Processing...');
				setColor('grey');
			}
		}

		let title =
			'Linting: ' +
			[
				eslintFinished ? 'eslint: ' + eslintFinished : null,
				tsFinished ? 'typescript: ' + tsFinished : null,
			]
				.filter(Boolean)
				.join('; ');

		setTitle(title ? title : '...');
	};

	const addToEntry = ({ filePath, ...data }) => {
		const entry = getEntry(filePath);

		entry.errorCount++;
		entry.messages.push({
			...data,
			filePath,
		});

		//outputMessages();
	};

	return async (fileNames) => {
		setColor('grey');

		fileNames = fileNames.filter((fileName) => fs.lstatSync(fileName).isFile());

		fileMap.clear();
		eslintFinished = false;
		tsFinished = false;

		timeFromStart = perfMeasure();

		const allFiles = await fg(path.resolve(watch, '**/*.{ts,tsx,js,jsx}'));

		const lintViaEslint = async () => {
			await Promise.all(
				allFiles.map(async (fileName) => {
					const report = eslintEngine.executeOnFiles(fileName);

					report.results.forEach((result) =>
						result.messages.forEach((message) =>
							addToEntry({
								filePath: result.filePath,
								...message,
								message: `[  ESLint  ] ${message.message}`,
							}),
						),
					);
				}),
			);

			eslintFinished = timeFromStart();
			//		outputMessages();
		};

		const lintViaTs = async () => {
			await Promise.all(
				fileNames
					.filter((file) => !file.endsWith('.js') && !file.endsWith('.jsx'))
					.map((fileName) => project.getSourceFile(fileName).refreshFromFileSystem()),
			);

			// project.getSourceFiles(fileNames).forEach((f) => f.forget());
			// project.addExistingSourceFiles(fileNames);

			const diagnostics = [
				...program.getSemanticDiagnostics(),
				// ...program.getSyntacticDiagnostics(),
				// ...program.getDeclarationDiagnostics(),
			];

			for (const diagnostic of diagnostics) {
				const filePath = diagnostic.getSourceFile().getFilePath();

				// TODO: add formatDiagnosticsWithColorAndContext from https://github.com/microsoft/TypeScript/blob/0cf00fab93b78c78968fb6601b20704d92220724/src/compiler/program.ts

				addToEntry({
					filePath,
					message: '[TypeScript] ' + `TS${diagnostic.getCode()}: ` + diagnostic.getMessageText(),
					severity: 'error',
					line: diagnostic.getLineNumber(),
					column: diagnostic.getStart(),
				});
			}

			tsFinished = timeFromStart();
			//	outputMessages();
		};

		await Promise.all([lintViaEslint(), lintViaTs()]);

		outputMessages();
	};
};
