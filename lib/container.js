
import { constructorChain }	from './proto.js';
import { CodeBuilder }		from './builder.js';
import { Module }			from './module.js';


const	MODULE	= Symbol('Container.MODULE'),
		BUILDER	= Symbol('Container.BUILDER'),
		BINDING	= Symbol('Container.BINDING');


/**
 * The current *path* being traversed, while determining validity of a
 * particular binding, in the context of a specific set of `Module` metadata.
 *
 * This is used to produce informative `Error` messages, when a circular
 * dependency is formed by dependency declaration, or binding - so that the
 * application can determine *why* a circular dependency occurs.
 */
class Stack {

	constructor() {
		this.set	= new Set();
		this.stack	= [];
	}

	/**
	 * Push a new `type` `function` onto the stack, with an `origin` message
	 * about why this `type` is now being evaluated.
	 *
	 * @param {Function} type	A constructor `function` of a type being evaluated.
	 * @param {String} origin	A contextual description of why this `type` is
	 *							being considered.
	 */
	push(type, origin) {
		this.set.add(type);
		this.stack.push(origin);
	}

	/**
	 * Remove the last added type from this stack.
	 */
	pop() {
		this.set.delete(this.stack.pop());
	}

	/**
	 * Determine whether the `type` specified already exists within the current
	 * stack, indicating that a circular dependency has been declared.
	 *
	 * @param {Function} type	The constructor `function` of a type to check.
	 *
	 * @return {Boolean}	`true` if this `type` already exists on the stack.
	 */
	has(type) {
		return this.set.has(type);
	}

	/**
	 * Return an array of `origin` `String`s, declared during the production of
	 * this stack.  At the point of dependency discovery, this lists the
	 * injections that caused this.
	 *
	 * @return {Array}	An `Array` of `String` descriptions of origins.
	 */
	origins() {
		return this.stack;
	}

}


/**
 * A container, responsible for correlating declared `Module` metadata, with
 * *bound* concrete implementations, and a `CodeBuilder` to produce the required
 * factories to create and satisfy instances of registered types.
 */
export class BoundContainer {

	/**
	 * Construct and return a new `BoundContainer`, associated with the `Module`
	 * management instance passed, and capable of dynamically generating
	 * factories, determining circular dependencies, and creating instances of
	 * any constructor passed.
	 *
	 * @param {Module} module	A `Module` manager for declarative metadata.
	 */
	constructor(module) {
		this[ MODULE ]	= module;
		this[ BUILDER ]	= new CodeBuilder(this, module);
		this[ BINDING ]	= new Map();

		// To remain unopinionated, recheck if a module's metadata changes after
		// binding begins.
		module.on(Module.UPDATE, (type) => {
			this.validate(type);
			this[ BUILDER ].build(type);
		});

		// Validate, and prebuild factory functions for all currently declared
		// modules.
		for(let type of module) {
			this.validate(type);
			this[ BUILDER ].build(type);
		}
	}

	/**
	 * Declare that any dependency of `type` should, in fact, be satisfied with
	 * an instance of `implementation`, instead.
	 *
	 * @param {Function} type			A constructor to bind from.
	 * @param {Function} implementation	A constructor to bind to.
	 *
	 * @return {BoundContainer} `this` for `function` chaining.
	 */
	bind(type, implementation) {
		this[ BINDING ].set(type, implementation);

		this.validate(implementation);

		this[ BUILDER ].build(type);
		return this;
	}

	/**
	 * Create an instance of `type`, satisfying the declarative, and bound
	 * requirements of this `BoundContainer`.
	 *
	 * @param {Function} type	The constructor of the type to create an instance of.
	 *
	 * @return {Object}	An instance of the type requested.
	 */
	create(type) {
		return this[ BUILDER ].get(type)();
	}

	/**
	 * Discover which class will be returned if this `BoundContainer` is asked to
	 * create an instance of `type`.
	 *
	 * @param {Function} type	The constructor to resolve.
	 *
	 * @return {Function}	The type that would be created by this container.
	 */
	resolve(type) {
		let last = type;
		while(type = this[ BINDING ].get(last)) { last = type; }
		return last;
	}

	/**
	 * Validate the creation of an instance of `type` would not create any
	 * circular dependency, and thus cause an infinite loop attempting to
	 * satisfy its requirements.
	 *
	 * This method throws an `Error` on circular dependency injection, with its
	 * message containing the *path* that lead to the circular dependency.
	 *
	 * @param {Function} type	The constructor to validate.
	 */
	validate(type) {
		const stack = new Stack();

		const walkArray = (array) => {
			for(let index = 0; index < array.length; index++) {
				validateDefinition(array[ index ]);
			}
		};

		const walkObject = (object) => {
			for(let key of Object.getOwnPropertyNames(object)
							.concat(Object.getOwnPropertySymbols(object))) {
				validateDefinition(object[ key ]);
			}
		};

		const validateInjects = (type) => {
			const properties = Object.create(null);

			// Loop through prototype chain, to determine inherited injections.
			for(let constructor of constructorChain(type)) {
				let data = this[ MODULE ].getData(constructor);
				if (!data) { continue; }

				// Loop through injections.
				for(const { key, definition, method } of data.injects) {
					if (properties[ key ]) { continue; }
					properties[ key ] = true;

					// Create a useful diagnostic path, in case a circular
					// dependency is discovered.
					stack.push(type, type.name
					 	+ (typeof key === 'symbol'
							? '[' + key.toString() + ']'
							: `.${ key }`)
						+ (method ? '()' : '')
					);
					validateDefinition(definition);
					stack.pop();
				}
			}
		};

		const validateType = (type) => {
			const resolved = this.resolve(type);

			// If a type exists in the current stack, a circular dependency
			// has been discovered.
			if (stack.has(resolved)) {
				throw new Error('Circular dependency discovered: '
					+ stack.origins().join(' -> ') + ' injects: '
					+ type.name
					+ (type !== resolved
						? ` (resolved to ${ resolved.name })`
						: '')
				);
			}

			const data = this[ MODULE ].getData(type) || Object.create(null);

			if (data.construct) {
				stack.push(type, `${ type.name }(constructor)`);
				validateDefinition(data.construct);
				stack.pop();
			}

			validateInjects(type);
		};

		const validateDefinition = (definition) => {
			if (Array.isArray(definition)) {
				return walkArray(definition);
			}else if (!definition.prototype) {
				return walkObject(definition);
			}else{
				return validateType(definition);
			}
		};

		validateType(type);
	}

}
