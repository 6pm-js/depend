# @6pm/depend

Declarative dependency injection.


## Table of contents

- [Install](#Install)
- [Test](#Test)
- [Usage](#Usage)
	- [Declarative vs imperative](#Declarative-vs-imperative)
	- [Declaring dependencies](#Declaring-dependencies)
 	- [Creating instances, and satisfying dependencies](#Creating-instances-and-satisfying-dependencies)
	- [Runtime determination of concrete implementations](#Runtime-determination-of-concrete-implementations)
	- [Post injection intialisation](#Post-injection-intialisation)
	- [Inheritance](#Inheritance)
	- [As Promised](#As-Promised)
		-[Downstream dependencies as Promises](#Downstream-dependencies-as-Promises)
	- [Singletons](#Singletons)
	- [Destructured injection](#Destructured-injection)
- [Cyclic dependencies](#Cyclic-dependencies)
- [Performance](#Performance)
- [Contributing](#Contributing)


## Install

```sh
npm install @6pm/depend --save
```


## Test

To run the unit test suite.

```sh
git clone https://github.com/6pm-js/depend.git
cd depend
npm install
npm test
```

To run [nyc](https://github.com/istanbuljs/nyc) coverage tests.

```sh
git clone https://github.com/6pm-js/depend.git
cd depend
npm install
npm run cover
```

This will result in a textual summary display, and a detailed html coverage
report created in `/coverage`.


## Usage

Usage requires two distinct components, declaration of dependencies and
injection points - and runtime binding of concrete implementations, and creation
of instances / satisfying of dependencies.


### Declarative vs imperative

Why support two non-standard ES extensions?  Both class properties, and
decorators are in a state of flux, not yet stable in any upcoming ES spec
(at the time of writing), but there are available implementations that work, and
there is something eminently readable about declarative approaches.

The imperative mechanism allows backwards compatible integration with existing
libraries, or the *safer* path, if desired - but the declarative approach is
a personal preference, as I find it considerably less surprising, and more
explicit about intent.

There is no need to intrument to allow the declarative, decorator approach,
unless you intend to use it within your project, and no capability is unique
to either approach - choose whichever you are comfortable with.


### Declaring dependencies

Dependencies are declared using either the declarative decorator syntax:

```js
import { Inject } from '@6pm/depend';
import { InjectedType } from 'wherever'

class SomeClass {

	@Inject(InjectedType)
	property = null;

}
```

or imperative syntax:

```js
import { Depend } from '@6pm/depend';
import { InjectedType } from 'wherever'

class SomeClass {}

Depend.inject(SomeClass, 'property', InjectedType);
```

Dependencies can be attached to the whole class, in which case they apply to the
constructor function, supplying the parameters to it, when created via a
`Container`:

```js
import { Inject, Depend } from '@6pm/depend';
import { InjectedTypeA, InjectedTypeB } from 'wherever'

// Declarative approach
@Inject(InjectedType, InjectedTypeB)
class SomeClass1 {

	constructor(injectedInstanceA, injectedInstanceB) {}

}


// Imperative approach
class SomeClass2 {

	constructor(injectedInstanceA, injectedInstanceB) {}

}
Depend.inject(SomeClass, null, InjectedTypeA, InjectedTypeB);
// The ^null is important, it specifies that we're not targeting a property of
// SomeClass2, but the constructor.
```

The legacy decorator plugin, for Babel, does not allow decoration of
constructors directly - which is why the declarative approach must decorate the
class, rather than the actual `constructor` function.

Dependencies can also be injected directly into class methods, which are treated
as setter functions:

```js
import { Inject, Depend } from '@6pm/depend';
import { DatabaseAbstraction } from './database.js'

// Declarative approach
class SomeClass1 {

	@Inject(DatabaseAbstraction)
	setDatabaseAbstraction(dbAPI) {}
}


// Imperative approach
class SomeClass2 {

	setDatabaseAbstraction(dbAPI) {}

}
Depend.inject(SomeClass, 'setDatabaseAbstraction', DatabaseAbstraction);
```


### Creating instances, and satisfying dependencies

Once a class is declared as managed by depend, it should not be manually
instantiated with `new`, but instead created via a managed `Container`.  The
`Container` ensures that any dependencies declared are satisified, including
sub-dependencies before returning an instance.

```js
import { Inject, Container } from '@6pm/depend';
import { DatabaseAbstraction } from './database.js'

@Inject(DatabaseAbstraction)
class SomeClass {

	constructor(databaseAbstraction) {
		// This will be called prior to create, below, completing.
	}

}

// A new instance of DatabaseAbstraction will be created, and provided to the
// SomeClass constructor, prior to the new SomeClass instance being returned.
let instance = new Container().create(SomeClass);
```


### Runtime determination of concrete implementations

The `Container` class does much more than just create instances, and satisfy
dependencies - it can also be used to specify alternate implementations to use
at runtime, when a particular dependency type is encountered.

This is achieved using the `.bind()` method on the `Container` instance.

```js
import { Inject, Container } from '@6pm/depend';
import { DatabaseAbstraction } from './database.js'
import { DatabaseMySQL } from './database-mysql.js'

@Inject(DatabaseAbstraction)
class SomeClass {

	constructor(databaseAbstraction) {
		// This will be called prior to create, below, completing.
	}

}

// A new instance of DatabaseMySQL will be created, and provided to the
// SomeClass constructor, prior to the new SomeClass instance being returned.
let instance = new Container()
	.bind(DatabaseAbstraction, DatabaseMySQL)
	.create(SomeClass);
```


### Post injection intialisation

A single function per class may be marked as an `init` function, which will be
executed after all dependency injection has been completed on a new instance of
the owning class, like so:

```js
import { Init } from '@6pm/depend';

class SomeClass {

	@Init
	someInitFunction() {
		// This will only execute once a Container.created instance of SomeClass
		// has been fully created, and all dependencies injected.
	}

}
```

or, imperatively:

```js
import { Depend } from '@6pm/depend';

class SomeClass {

	someInitFunction() {
		// This will only execute once a Container.created instance of SomeClass
		// has been fully created, and all dependencies injected.
	}

}

Depend.init(SomeClass, 'someInitFunction');
```


### Inheritance

Dependencies are inherited using the ES2016 class format, or traditional
prototypical inheritance.  So extending a managed class automatically confers
all requirements, and determines overloaded requirements, too.

```js
class A {

	@Inject(SomeType)
	property;

}

class B extends A {}

class C extends A {

	@Inject(AlternativeType)
	property;

}
```

In the above example, creating an instance of `B` will inject `SomeType` into
`property`, as an inherited requirement.  Creating an instance `C` will inject
an instance of `AlternativeType`, instead, without requiring, or creating an
instance of `SomeType` first.


### Typical phases of a dependency injected application

The phases of a dependency injected application are typically:

- Declaration of intent / dependencies
	- Using `@Inject`, `@Abstract` and `@Singleton` to declare intent, and requirements.
	- This typically occurs throughout the application, where ever components reside.

- Configuration / binding
	- Creating a `Container` instance, and binding concrete implementations
	- This typically occurs in a single *setup* file that applies configuration
	for a given environment.

- Runtime usage
	- Wherever new instances are required, the `Container` instance created in
	the configuration / binding step is used to create new instances, and
	automatically satisfy any required dependencies.

As an example:

- Declaration:

`./service.js`;
```js
import { Inject, Singleton } from '@6pm/depend';

class Service {

	@Inject(Logger)
	logger;

	start() {
		logger.log('Started!');
	}
}
```

`./interface/someLogger.js`;
```js
class Logger {

	@Abstract
	log(message) {}

}
```

`./implementation/console-logger.js`;
```js
class ConcreteConsoleLogger {

	log(message) {
		console.log(message);
	}

}
```

- Configuration / binding

`./configuration/container.js`
``` js
import { Container } from '@6pm/depend';

import Logger from './interface/logger';
import ConcreteLogger from './implementationconsole-logger';

function configure() {
	let container = new Container();

	container.bind(Logger, ConcreteLogger);

	return container;
}

export let container = configure();
```

- Runtime usage:

`main.js`
```js
import Service from './service.js';
import container from './configuration/container.js';

let service = container.create(Service);
service.start();
```


### As Promised

Some dependencies cannot be ready for injection until they have accessed remote
resources, whether to obtain configuration, or connections, resources, etc.

In order to facilitate this, without introducing surprising levels of variance
in return types, `Promise`s may be returned from three key points within the
dependency injection lifecycle:

- constructor
- injected property setter
- init

If any of the above methods return a `Promise` then `container.create` will also
return a `Promise` that resolves to the new instance if, and only if any and
all `Promise`s returned resolve successfully - or reject on the first that
rejects.

If all three (or any combination) of the above methods return `Promise`s, then
they are guaranteed to resolve in the oder listed above, and reject in the same
order.

If multiple injected setters are declared on a single class, and return multiple
`Promise`s, then they will occur, effectively, simultaneously, with no order
guarantees between them, but they will be sychronised using `Promise.all` prior
to an `init` function being executed.


#### Downstream dependencies as Promises

In order to:

a) Prevent surprise (and cascading requirements to handle Promises)
b) Ensure control flow options remain the preserve of the application developer

Downstream dependencies that return `Promise`s *DO NOT* automatically promote
an upstream type to a `Promise`.

That is, if, say, class `A` declares a dependency injection of an instance of
class `B`, and `B` is a `Promise`, creating an instance of `A` will not result
in a `Promise`, unless it explicitly returns a `Promise` as described in the
previous section.

As mentioned above, this prevents surprise (concrete implementation `C` is
bound as runtime configuration, and resolves to a `Promise`, where `B` did not),
and ensures that the application programmer can choose how to handle such a
situation - the dependency injected instance of `A` may not need the downstream
dependency to be resolved from a `Promise` prior to being created -
automatically doing so would create an automatic synchronicity between steps,
preventing, say, the ability to handle resolving of a `Promise`, and triggering
of any further logic as a consequence, asynchronously.

Handling of such downstream dependencies is therefore left as an exercise to the
application developer, and any injected dependencies that resolve to a `Promise`
will merely deliver the `Promise` - if dependency injection should wait for
resolution of a `Promise`d dependency, that can cascaded manually, by returning
a `Promise` from any of the previously mentioned lifecycle methods, or, using
`async` / `await` syntax, if available, like so:

```js

import { Inject, Container } from '@6pm/depend';
import { DatabaseAbstraction } from './database.js'

@Inject(DatabaseAbstraction)
class SomeService {

	async constructor(databaseAbstraction) {
		this.db = await databaseAbstraction;
		return this;
	}

	@Init
	init() {
		// This method will only be called if the construction succeeded, and
		// the `.db` property has successfully resolved, and is available.
	}

}


async function startService() {
	try{
		let someService = await new Container()
			// .bind() any runtime configuration here
			.create(SomeService);

		// someService will now exist, with a fully resolved `.db` property.
		someService.start();

	}catch(e) {
		// someService failed to instantiate, the causal error (from
		// DatabaseAbstraction, or the bound concrete implementation, thereof),
		// will be caught here.
	}
}

startService();

// Alternatively, using the raw `Promise` flow.
new Container()
	// .bind() any runtime configuration here
	.create(SomeService)
	.then(function(someService) {
		// Fully resolved `someService` instance now available to use, with a
		// resolved `.db` property.
		someService.start();
	}).catch(function(error) {
		// If the `DatabaseAbstraction` rejects for some reason, `someService`
		// instantiation will fail, calling this function with the causal Error.
	});
```


### Singletons

In addition to supplying instances of types, and binding them dynamically at
runtime, certain classes may be designed to be shared, requiring one, and only
one instance, which should to be passed to any declared dependency.  This can
be achieved by declaring a class as a singleton, using either a declarative
decorator, or imperative style.

```js
import { Singleton, Depend } from '@6pm/depend';

@Singleton
class A {}

class B {}
Depend.singleton(B);
```

Any class declaring a dependency of `A`, or `B` will only instantiate a single
instance, and all will receive that single instance.

This is particularly useful for injecting common implementations, such as a
datastore abstraction (that, say, handles connection pooling under the hood), or
a configured logging interface, or arbitration mechanism for contentious
resources, common application configuration, etc.


## Interfaces in a language without interfaces

JavaScript does not have any real concept of interfaces, so the depend library
provides a mechanism to allow an effective approximation of the concept.

Methods, or entire classes, can be declared as abstract via the decorator or
imperative approach, as so:

```js
import { Abstract, Depend } from '@6pm/depend';

@Abstract
class A {}

class B {

	@Abstract
	someMethod() {}

}

class C {}
Depend.abstract(C);
```

The abstract property is automatically conferred to the owning class, if a method
is declared abstract, and has the following effects:

- *For methods* - any attempt to invoke the method will throw an `Error` that the
method is abstract, and should be overloaded in a subclass.

- *For classes* - any attempt to `create` an instance of the class, via a container,
will throw an `Error` indicating that the class is abstract, and a concrete
extension of the class should be used instead.

While the depend library, and JavaScript do not validate that the contract of
an interface is honoured, this adds a degree of safety, as a failure to `bind` a
concrete implementation will result in the creation of a new instance failing,
should an abstract class be requested at any stage as a dependency - which
ensures fast failure, at startup - and the potential to catch an erroneous
configuration during an integration test of production configuration.


### Destructured injection

In addition to specifying types to be resolved during dependency injection, the
depend library can accept a limited form of destructured assignment, providing
more complex structures, such as array literals, and object literals, like so:

```js
@Inject({ database: DatabaseAbstraction, logger: LoggerAbstraction })
class SomeClass {

	constructor(options) {
		this.database = options.database;
		this.logger = options.logger;
	}

}
```

Any depth of array and object literal definitions will be traversed and injected
as needed - which works particularly well with ES2016 destructured assignment:

```js
@Inject([ { sub: A }, [ B, C ] ])
class SomeClass {

	constructor([ { sub:a }, [ b, c ] ]) {
		// a, b and c receive instances of A, B and C respectively.
	}

}
```


## Cyclic dependencies

The depend library automatically determines if dependencies cause cycles, both
at the point of declaration of dependencies, and when binding concrete
implementations, and will throw if such a situation occurs - since cyclical
dependencies can never be correctly satisfied.

If `A` requires an instance of `B`, that then requires and instance of `C`,
that then requires `A`, there is no way to determine a *satisfied* state for
any instance along the cyclical chain.

If a cycle is detected, an `Error` is thrown from either the dependency
declaration (the `@Inject` or `Depend.inject), or the `bind` call that causes
the cycle.


## Performance

The depend library is designed to be very performant, using two primary methods:

- Front loading as much work as possible, to ensure that creating, and satisfying
new instances is as cheap as possible.  In particular, cycle detection occurs
during the declaration of dependencies, and the container binding stage -
ensuring that the cost does not affect run time performance, and usage patterns.

- Dynamic code generation, to allow the ES runtime / compiler to optimise away
as much work as possible - while a contentious technique, this is never visible
externally, but testing during development, (via microbenchmarks - YMMV), proved
to provide more than 3 orders of magnitude difference in instance creation.

In addition, the dynamic code generation, on v8 in particular, adds very
little startup overhead.


## Contributing

All issues, requests, questions, PRs, improvements, or merely comments welcome!
All I ask is to attempt to conform to the rather loose house style, if opening a
pull request!
