import should from 'should';

import { Module } from '../lib/module.js';
import { BoundContainer } from '../lib/container.js';
import { Depend, Inject, Container } from '../lib/depend.js';


describe('container', () => {

	it('should instantiate bound targets', () => {
		class A {}
		class B {}

		let instance = new Container().bind(A, B).create(A);
		instance.should.be.instanceOf(B);
	});

	it('should instantiate previously unknown targets', () => {
		class A {}

		let instance = new Container().create(A);
		instance.should.be.instanceOf(A);
	});

	it('should identify direct circular dependencies', () => {
		class A {}
		class B {

			@Inject(A)
			a;

		}

		should(() => {
			new Container().bind(A, B).create(A);
		}).throw(/Circular dependency/)
	});

	it('should identify destructured object circular dependencies', () => {
		class A {}
		class B {

			@Inject({ a: A })
			a;

		}

		should(() => {
			new Container().bind(A, B).create(A);
		}).throw(/Circular dependency/)
	});

	it('should identify destructured object Symbol circular dependencies', () => {
		const SYMBOL = Symbol();

		class A {}
		class B {

			@Inject({ [ SYMBOL ]: A })
			a;

		}

		should(() => {
			new Container().bind(A, B).create(A);
		}).throw(/Circular dependency/)
	});

	it('should identify destructured array circular dependencies', () => {
		class A {}
		class B {

			@Inject([ A ])
			a;

		}

		should(() => {
			new Container().bind(A, B).create(A);
		}).throw(/Circular dependency/)
	});

	it('should identify Symbol assigned circular dependencies', () => {
		class A {}
		class B {}

		const SYMBOL = Symbol();

		Depend.inject(B, SYMBOL, A);

		should(() => {
			new Container().bind(A, B).create(A);
		}).throw(/Circular dependency/)
	});

	it('should identify purely injected circular dependencies', () => {
		should(() => {

			class A {}
			class B {}
			class C {}

			// Build custom injection to test this, so that we don't pollute
			// the global module manager with a circular dependency.
			let module 		= new Module(),
				container	= new BoundContainer(module);

			module.declareInject(A, 'a', [ B ]);
			module.declareInject(B, 'a', [ C ]);
			module.declareInject(C, 'a', [ A ]);

		}).throw(/Circular dependency/)
	});

});
