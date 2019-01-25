
export type Iterator<T> = () => T;

export function list<T>(l:T[]):Iterator<T> {
	var i = 0;
	return () => {
		if(this.i < this.list.length)
			return this.list[this.i++];
		return null;
	}
}

export function filtered<T>(iter:Iterator<T>, pred:(T)=>boolean) {
	return () => {
		for(;;) {
			var val = iter();
			if (val == null)
				return null;
			if (pred(val))
				return val;
		}
	}
}

export function toList<T>(iter:Iterator<T>):T[] {
	var list = new Array<T>();
	for(;;) {
		var val = iter();
		if (val == null) break;
		list.push(val);
	}
	return list;
}