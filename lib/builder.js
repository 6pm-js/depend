import { constructorChain } from './proto.js';


/**
 * Private manager for outer closure parameters being passed to a new
 * dynamic constructor function.
 */
class Params {

	/**
	 * Create a new instance to manage parameters passed to a dynamically created
	 * function.
	 *
	 * @param {String} prefix	The prefix to associate with all closure parameters.
	 */
	constructor(prefix = 'p') {
		this.indexMap	= new Map();
		this.array		= [];
		this.prefix		= prefix;
	}

	/**
	 * Record the value passed, associate a parameter name with it, and return
	 * the parameter name.
	 *
	 * @param {any} value	The value to associate with a managed parameter.
	 *
	 * @return {String}	The name of the associated parameter.
	 */
	for(value) {
		if (this.indexMap.has(value)) {
			return this.prefix + this.indexMap.get(value);
		}
		let index = this.indexMap.size;
		this.indexMap.set(value, index);
		this.array.push(value);

		return this.prefix + index;
	}

	/**
	 * Return an array of all parameter names allocated by this instance.
	 *
	 * @return {Array} An array of `String` parameter names.
	 */
	names() {
		return this.array.map((a, i) => `${ this.prefix }${ i }`);
	}

	/**
	 * Return an array of all parameter types (arguments) associated with
	 * paramater names managed by this instance.
	 *
	 * @return {Array} An array of arguments managed by this instance.
	 */
	values() {
		return this.array;
	}

}


/**
 * Encapsulation of dynamic code building, from `Module` definitions.
 */
export class CodeBuilder {

	/**
	 * Construct a new `CodeBuilder`, for a given combination of
	 * `BoundContainer` bindings, and `Module` metadata.
	 *
	 * @param {BoundContainer}	binding	The `BoundContainer` to resolve from.
	 * @param {Module} module	The `Module` manager, to obtain metadata.
	 */
	constructor(binding, module) {
		// Semi private reference to factory `functions` build by this instance.
		this.BUILD			= Symbol('CodeBuilder.BUILD');

		this.binding		= binding;
		this.module			= module;

		this.dependencies	= new Map();
	}

	/**
	 * Get a `function` to instantiate the `type` passed.
	 *
	 * @param {Function} type	The constructor `function` to get a builder for.
	 *
	 * @return {Function}	A `function` that will build an instance of `type`.
	 */
	get(type) {
		return type.hasOwnProperty(this.BUILD)
			? type[ this.BUILD ]
			: function() { return new type(); };
	}

	/**
	 * Build a new builder `function` for the `definition` given.
	 *
	 * @param {any} definition	The definition of the dependency to build for.
	 *
	 * @return {Function}	A `function` that will build the appropriate structure.
	 */
	build(definition) {
		return new Function('return '
			+ this.anyBuilder(definition, new Params(), true) + ';');
	}

	/**
	 * Build the injection statements for a given `type`, to inject into
	 * properties, or setter methods, after construction.
	 *
	 * @param {Function} type	The constructor function of the type.
	 * @param {Params} params	The `Params` instance containing closure params.
	 *
	 * @return {String}	Dyanmically generated source to furnish `type` with its
	 *					post-construction injected dependencies.
	 */
	injectBuilder(type, params) {
		let body		= '',
			properties	= Object.create(null);

		// Loop through the prototype chain, to furnish any inherited requirements.
		for(let constructor of constructorChain(type)) {

			let data = this.module.getData(constructor);
			if (!data) { continue; }

			// Loop through all declared dependency injections.
			for(let { key, definition, method } of data.injects) {

				// Skip injections that have been overridden further down the chain.
				if (properties[ key ]) { continue; }
				properties[ key ] = true;


				if (method) {
					body += `
					{
						let result = instance[ ${ params.for(key) } ](
							${ this.arrayBuilder(definition, params) }
						);
						if (result && result.then) { promises.push(result); }
					}`;
				}else{
					body += `instance[ ${ params.for(key) } ]`;
					body += ` = ${ this.anyBuilder(definition, params) };\n`;
				}
			}

		}

		return body;
	}

	/**
	 * Build the source of a factory function to build an instance of `type`
	 * according to the bound associations, and declarative requirements of this
	 * `CodeBuilder`.
	 *
	 * This method actually creates two things:
	 * 1) A `function` to create an instance of this `type`, which is compiled
	 *    and associated with the constructor, via a semi-private `Symbol`.
	 * 2) Source to invoke the appropriate build `function`, which is returned.
	 *
	 * This approach allows *upstream* bindings to redirect build functions
	 * without having to rebuild the entire dependency chain every time.
	 *
	 * @param {Function} type		The constructor function of the type.
	 * @param {Params} params		The `Params` instance containing closure params.
	 * @param {Booilean} rebuild	Optionally rebuild if an appropriate function
	 *								is already associated.
	 *
	 * @return {String}	Dyanmically generated source required to build an instance
	 *					of `type`, with all dependencies satisfied.
	 */
	typeBuilder(type, params, rebuild) {
		if (rebuild || !type.hasOwnProperty(this.BUILD)) {

			let data = this.module.getData(type) || Object.create(null);

			if (data.abstract) {
				// Abstract classes cannot be instantiated directly.
				type[ this.BUILD ] = function() {
					throw new Error(`'${ type.name }' is abstract, `
						+ `and cannot be instantiated`);
				};
			}else{
				let subParams		= new Params(),
					constructParams	= data.construct ? this.arrayBuilder(data.construct, subParams) : '',
					injections		= this.injectBuilder(type, subParams),
					init			= data.init ? `instance[ ${ subParams.for(data.init) } ]()` : 'false',
					singleton		= data.singleton ? `${ subParams.for(type) }[ BUILD ] = function() { return instance; };` : '',

					body = `
				return function() {
					let instance = new ${ subParams.for(type) }(${ constructParams});

					if (instance && instance.then) {
						return instance.then(function(instance) {
							let promises = [];
							${ injections };

							if (promises.length) {
								return Promise.all(promises).then(function() {
									let result = ${ init };

									${ singleton }

									return (result && result.then)
										? result.then(function() { return instance; })
										: instance;
								});
							}else{
								let result = ${ init };

								${ singleton }

								return (result && result.then)
									? result.then(function() { return instance; })
									: instance;
							}
						});
					}else{
						let promises = [];
						${ injections };

						if (promises.length) {
							return Promise.all(promises).then(function() {
								let result = ${ init };

								${ singleton }

								return (result && result.then)
									? result.then(function() { return instance; })
									: instance;
							});
						}else{
							let result = ${ init };

							${ singleton }

							return (result && result.then)
								? result.then(function() { return instance; })
								: instance;
						}
					}
				}
				`;

				let outer = new Function('BUILD', ...(subParams.names()), body);
				type[ this.BUILD ] = outer(this.BUILD, ...subParams.values());
			}
		}

		return `${ params.for(type) }[ BUILD ]()`;
	}

	/**
	 * Build the source to produce a destructured array of dependencies.
	 *
	 * @param {Array} array		The array of destructured requirements.
	 * @param {Params} params	The `Params` instance containing closure params.
	 *
	 * @return {String}	Dyanmically generated source to build the static array
	 *					of destructured dependencies.
	 */
	arrayBuilder(array, params) {
		let elements = [];
		for(let element of array) {
			elements.push(this.anyBuilder(element, params));
		}
		return `${ elements.join(', ') }`;
	}

	/**
	 * Build the source to produce a destructured object of dependencies.
	 *
	 * @param {Object} object	The object containing destructured requirements.
	 * @param {Params} params	The `Params` instance containing closure params.
	 *
	 * @return {String}	Dyanmically generated source to build the static Object
	 *					containing destructured dependencies.
	 */
	objectBuilder(object, params) {
		let keys		= Object.getOwnPropertyNames(object)
							.concat(Object.getOwnPropertySymbols(object)),
			properties	= [];

		for(let key of keys) {
			properties.push(`[${ params.for(key) }]:`
				+ this.anyBuilder(object[ key ], params));
		}
		return properties.join(',\n');
	}

	/**
	 * Build the source to produce some, as yet, unknown definition of dependencies.
	 *
	 * The `rebuild` parameter *only* propagates if `any` is actually a direct
	 * constructor - it *will not* rebuild array or object literal dependencies -
	 * this prevents a thundering herd of rebuild activity when a single module's
	 * metadata changes.
	 *
	 * @param {any} any	Some definition to build dependency satifying source for.
	 * @param {Params} params	The `Params` instance containing closure params.
	 * @param {Booilean} rebuild	Optionally rebuild if an appropriate function
	 *								is already associated.
	 *
	 * @return {String}	Dyanmically generated source to build the static Object
	 *					containing destructured dependencies.
	 */
	anyBuilder(any, params, rebuild) {
		if (Array.isArray(any)) {
			return '[ ' + this.arrayBuilder(any, params) + ' ]';

		}else if (!any.hasOwnProperty('prototype')) {
			return '{\n' + this.objectBuilder(any, params) + '\n}\n';

		}else{
			let resolved = this.binding.resolve(any);
			if (resolved !== any) {
				let BUILD = this.BUILD;

				any[ BUILD ] = function() {
					return resolved[ BUILD ]();
				};
			}
			return this.typeBuilder(resolved, params, rebuild);
		}

	}

}
