import { Module }			from './module.js';
import { BoundContainer }	from './container.js';


/**
 * Obtain the constructor from the prototype passed by the package
 * "transform-decorators-legacy".  This function bridges the difference between
 * directly supplied constructors, and the prototype supplied via the decorator
 * evaluation at runtime - ensuring that mixing declaratative and imperative
 * methods actually reference the same eventual objects.
 *
 * @param {Object} type	The `prototype` of a type being modified.
 * @return {Function} The `constructor` function.
 */
function constructor(type) {
	return type.constructor === Function ? type : type.constructor;
}

// Global `Module` instance.
const module = new Module();


// ----------------------------- DECORATOR API ---------------------------------

/**
 * Declare a constructor, setter method, or property injection point - supplying
 * the parameter types to be injected at said point, when building.
 *
 * For constructors, and setter methods, multiple definitions can be supplied,
 * which will be enumerated as arguments to the constructor, or method.
 *
 * When injecting into a property, only a single definition is allowed.
 *
 * Definitions may be a constructor of an expected type, or any combination and
 * depth of array or object literals, which will be satisfied according to the
 * bindings attached to a particular container, when used to provide an instance
 * of the class being decoarated.
 *
 * @param definitions	One or more types, or destructured definitions of types
 *						to be injected into this target.
 */
export function Inject(...definitions) {
	return function(target, key, descriptor) {
		module.declareInject(constructor(target), key, definitions);

		if (descriptor && !descriptor.writable) {
			descriptor.writable = true;
		}

		return descriptor;
	};
};


/**
 * Indicate that a method, or entire type is `Abstract` - meaning that:
 *
 * For a method, invocation will throw an `Error`.
 * For a type / class, instantiation will throw and `Error`.
 *
 * Declaring a method as `Abstract` implicitly confers the same to the owning
 * class.  Class definitions with abstract members are implicitly abstract, and
 * cannot be directly instantiated.
 *
 * This decorator effectively adds the ability to create interfaces in ES code,
 * and enforce the requirement of binding concrete implementations, in order
 * to successfully satisfy dependencies.
 */
export function Abstract(target, key, descriptor) {
	return module.declareAbstract(constructor(target), key, descriptor);
};


/**
 * Declare a class method as an `Init` function, to be invoked only after all
 * dependencies have been satisfied.
 */
export function Init(target, key, descriptor) {
	if (target.prototype) {
		throw new Error('@Init is only applicable to instance methods');
	}
	module.declareInit(constructor(target), key);
}


/**
 * Declare a class as a singleton, ensuring that all dependencies are satisified
 * using a single shared instance.
 */
export function Singleton(target, key, descriptor) {
	if (key !== undefined) {
		throw new Error('@Singleton is only applicable to classes');
	}

	module.declareSingleton(constructor(target));
}


// ---------------------------- IMPERATIVE API ---------------------------------


/**
 * Imperative API, for those uncomfortable with the (currently non-standard)
 * decorator approach!
 *
 * The methods exposed mirror the decorators above, providing the same options,
 * and capabilities, exactly, though requiring a `constructor` / class name
 * target, and, in some cases, a `key` declaring the property or method
 * identifier to attach to.
 */
export const Depend = new (class Depend {

	inject(target, key, ...definitions) {
		module.declareInject(target, key, definitions);
	}

	abstract(target, key) {
		module.declareAbstract(target, key);
	}

	init(target, key) {
		module.declareInit(target, key);
	}

	singleton(target) {
		module.declareSingleton(target);
	}

})();


// ----------------------------- CONTAINER API ---------------------------------

/**
 * A `Container` instance is the basic unit for runtime usage of dependency
 * injection.  It maintains the bindings from abstract types, to concrete
 * implementation to use, in a given context, and is responsible for satisfying
 * dependencies, and supplying instances of managed modules, via the `create`
 * method.
 */
export class Container extends BoundContainer {

	constructor(alternative) {
		super(alternative || module);
	}

}
