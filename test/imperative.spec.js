import should from 'should';

import { Container, Depend } from '../lib/depend.js';



describe('imperative', () => {

	describe('Depend.singleton', () => {

		it('should guarantee .singleton declared classes are singletons', () => {

			class B {}

			class A {
				a;
			}

			Depend.singleton(B);
			Depend.inject(A, 'a', B);

			let container	= new Container(),
				a			= container.create(A),
				b			= container.create(B);

			a.a.should.equal(b);
			b.should.equal(container.create(B));
		});

	});

	describe('Depend.abstract', () => {

		it('should not allow instantiation of .abstract declared classes', () => {

			class A {}

			Depend.abstract(A);

			should(() => new Container().create(A))
				.throw(/abstract/);
		});

		it('should allow instantiation of subclasses of .abstract declared', () => {

			class A {}
			class B extends A {}

			Depend.abstract(A);

			should(() => new Container().create(B))
				.not.throw(/abstract/);
		});

		it('should cause methods to throw if invoked', () => {

			class A {

				a() {}

			}

			Depend.abstract(A, 'a');

			should(() => new A().a())
				.throw(/abstract/);
		});

		it('should prevent instantiation of classes if applied to methods', () => {

			class A {

				a() {}

			}

			Depend.abstract(A);

			should(() => new Container().create(A))
				.throw(/abstract/);
		});

	});

	describe('Depend.init', () => {

		it('should cause the method decorated to be called after injection', () => {
			let called = false;
			class A {}
			class B {

				a;

				b() { called = this.a; }

			}

			Depend.inject(B, 'a', A);
			Depend.init(B, 'b');

			let instance = new Container().create(B);
			called.should.be.instanceof(A);
		});

	});

	describe('Depend.inject', () => {

		it('should inject into constructor parameters', () => {
			let called = false;

			class A {}

			class B {

				constructor(...params) {
					called = params;
				}
			}

			Depend.inject(B, null, A);

			let instance = new Container().create(B);
			called.should.eql([ new A() ]);
		});

		it('should inject multiple constructor parameters', () => {
			let called = false;

			class A {}
			class B {}

			class C {

				constructor(...params) {
					called = params;
				}
			}

			Depend.inject(C, null, A, B);

			let instance = new Container().create(C);
			called.should.eql([ new A(), new B() ]);
		});

		it('should inject into instance properties', () => {
			class A {}

			class B {

				a;

			}
			Depend.inject(B, 'a', A);

			let instance = new Container().create(B);
			instance.a.should.be.instanceof(A);
		});

		it('should inject into symbol properties', () => {
			class A {}

			class B {}

			const SYMBOL = Symbol();

			Depend.inject(B, SYMBOL, A);

			let instance = new Container().create(B);
			instance[ SYMBOL ].should.be.instanceof(A);
		});

		it('should allow injection into destructured symbol properties', () => {
			const SYMBOL = Symbol();

			class A {}

			class B {}

			Depend.inject(B, 'a', { [ SYMBOL ]: A });

			let instance = new Container().create(B);
			instance.a[ SYMBOL ].should.be.instanceof(A);
		});

		it('should only allow single params for property injections', () => {
			should(() => {
				class A {}
				class B {
					a;
				}

				Depend.inject(B, 'a', A, A);
			}).throw(/only specify one parameter/);
		});

		it('should inject into setter methods', () => {
			let called = false;

			class A {}

			class B {

				a(value) { called = value; }

			}

			Depend.inject(B, 'a', A);

			let instance = new Container().create(B);
			called.should.be.instanceof(A);
		});

		it('should inject multiple params into setter methods', () => {
			let called = false;

			class A {}
			class B {}

			class C {

				a(a, b) { called = [ a, b ]; }

			}

			Depend.inject(C, 'a', A, B);

			let instance = new Container().create(C);
			called.should.eql([ new A(), new B() ]);
		});

		it('should inject destructured dependencies into all the things', () => {

			class A {}
			class B {}
			class C {}

			class D {

				constructor(a, b) {
					this.construct = [ a, b ];
				}

				a(a, b, c) { this.setter = [ a, b, c ]; }

				b;

			}

			Depend.inject(D, null, { a: [ A, B, C ], b: { a: A }}, [ B, C ]);
			Depend.inject(D, 'a', { A }, [ B, A ], C);
			Depend.inject(D, 'b', C);

			let instance = new Container().create(D);

			instance.should.be.instanceof(D);
			instance.b.should.be.instanceof(C);
			instance.construct.should.eql([ { a: [ new A(), new B(), new C() ], b: { a: new A() } }, [ new B(), new C() ] ]);
			instance.setter.should.eql([ { A: new A() }, [ new B(), new A() ], new C() ]);
		});

	});

});
