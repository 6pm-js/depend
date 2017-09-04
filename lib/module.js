import { Emit } from '@6pm/emit';

/**
 * Meta data about dependencies declared in any managed Module.
 */
class DependencyData {

	injects		= [];
	construct	= null;
	init		= null;

	abstract	= false;
	singleton	= false;

}


/**
 * General interface to creating and storing meta data about modules and
 * dependencies.  Provides an iterator interface to iterate over all types
 * known - and an event emitter interface, that triggers on any additional
 * changes to declarations about managed modules.
 *
 * The event emitted interface allows binding and declaration to work, even when
 * interleaved as imperative statements at runtime - preventing a whole class
 * of unintuitive failure cases, should separate modules mix and match approaches.
 */
export class Module {

	constructor() {
		this.data = new Map();
	}


	/**
	 * Get currently associated meta data for a given type.
	 *
	 * @param {Function} type	A constructor representing a (possibly) managed type.
	 * @return {DependencyData} or `undefined` if not found.
	 */
	getData(type) {
		return this.data.get(type);
	}


	/**
	 * Create new `DependencyData` and associate it with the type passed.
	 *
	 * @param {Function}	type		A (possibly) managed type.
	 * @param {Object}		properties	Default properties to assign.
	 *
	 * @return {DependencyData} associated with the type.
	 */
	createData(type, properties) {
		if (!this.data.has(type)) {
			this.data.set(type, new DependencyData());
		}
		return Object.assign(this.getData(type), properties);
	}


	/**
	 * Delcare an injection requirement for the given type, property, or setter
	 * method.
	 *
	 * @param {Function}		type	The type to declare an injection for.
	 * @param {String | Symbol}	key		Optional key referencing property to inject into.
	 * @param {Array}			injects	The types or destructured definition to inject.
	 */
	declareInject(type, key, injects) {
		if (!key) {
			let data = this.createData(type);
			if (data.construct) {
				throw new Error('Can only specify one injection per constructor');
			}

			data.construct = injects;
		}else if (type.prototype && type.prototype[ key ] instanceof Function) {
			let data = this.createData(type);
			data.injects.push({ key: key, definition: injects, method: true });
		}else{
			if (injects.length > 1) {
				throw new Error('Can only specify one parameter for property injection');
			}

			let data = this.createData(type);
			data.injects.push({ key: key, definition: injects[ 0 ], method: false });
		}

		this.emit(Module.UPDATE, type);
	}


	/**
	 * Delcare a type, or method as abstract, preventing invocation (of a method),
	 * and direct instantiation (of the type).
	 *
	 * @param {Function}		type	The type to declare abstractr.
	 * @param {String | Symbol}	key		Optional key referencing property to declare abstract.
	 */
	declareAbstract(type, key, descriptor) {
		let data = this.createData(type, { abstract: true });

		if (key) {
			if (!type.prototype[ key ] || !(type.prototype[ key ] instanceof Function)) {
				throw new Error('Only classes or methods can be declared abstract');
			}

		 	function throwAbstract() {
				throw new Error(`'${ type.name }.${ key }()' is abstract, and must be overridden`);
			};

			type.prototype[ key ] = throwAbstract;

			return Object.assign(descriptor || { writeable: true, enumerable: false },
				{ value: throwAbstract });
		}

		this.emit(Module.UPDATE, type);
	}


	/**
	 * Delcare a type as a singleton - ensuring only instance will be created,
	 * and used to satisfy any dependencies that require this type.
	 *
	 * @param {Function}	type	The type to declare a singleton.
	 */
	declareSingleton(type) {
		this.createData(type, { singleton: true });

		this.emit(Module.UPDATE, type);
	}


	/**
	 * Delcare a method as an init function, to be invoked on a new instance
	 * after, and only after, all dependencies have been satisfied.
	 *
	 * @param {Function}		type	The type to declare an init function on.
	 * @param {String | Symbol}	key		The key for the init method.
	 */
	declareInit(type, key) {
		let data = this.createData(type);

		if (!type.prototype[ key ] || !(type.prototype[ key ] instanceof Function)) {
			throw new Error(`Can only declare methods 'init'`);
		}

		if (data.init) {
			throw new Error(`Classes may only have one 'init' method.`);
		}

		data.init = key;

		this.emit(Module.UPDATE, type);
	}


	/**
	 * Iterate over all types known to this Module instance.
	 *
	 * @return {Iterator} for all known types.
	 */
	[ Symbol.iterator ]() {
		return this.data.keys();
	}


	/**
	 * Semi-private event `Symbol`, emitted to indicate a change for a given
	 * managed class.
	 */
	static UPDATE = Symbol('Manager.UPDATE');

}

// Make Module instances event emitters lazily.
Emit.assign(Module.prototype);
