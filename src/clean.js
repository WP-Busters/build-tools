import del from 'del';

export const clean = (paths) =>
	del(
		paths
	);
