import prettyMilliseconds from 'pretty-ms';
import microtime from 'microtime';

export const perfMeasure = () => {
	const hrTime = microtime.nowDouble();

	return (text) => {
		return (text, prettyMilliseconds((microtime.nowDouble() - hrTime) * 1000));
	};
};
