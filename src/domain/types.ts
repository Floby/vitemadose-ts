export type Unpack<T> =
	T extends AsyncIterator<infer I>
	? I
	: never
