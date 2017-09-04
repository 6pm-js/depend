
/**
 * Produce an array of constructors in the chain for the given constructor.
 * This function is used to ensure that inherited dependencies are satisfied
 * in sub-classes.
 *
 * @param {Function} constructor	The constructor to begin walking from.
 *
 * @return {Array} An array of constructors extended by the one supplied.
 */
export function constructorChain(constructor) {
	let constructors = [];
	while(constructor) {
		constructors.push(constructor);
		if (constructor === Object) { break; }

		constructor = Object.getPrototypeOf(constructor.prototype).constructor;
	}
	return constructors;
}
