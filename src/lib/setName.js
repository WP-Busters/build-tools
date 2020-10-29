export const setName = (displayName, fn, log) => {
	log = log || console.log;
	log(`[start] ${displayName}`);
	// fn.displayName = displayName;
	return fn;
	// return async function() {
	// 	const r = await fn.call(this,arguments);
	// 	console.log(`[end] ${displayName}`);
	// 	return r;
	// };
};
