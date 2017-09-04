import should from 'should';

import { Singleton, Abstract, Init, Inject, Container } from '../lib/depend.js';


describe('decorator', () => {

	describe('@Singleton', () => {

		it('should not allow @Singleton to be applied to members', () => {

			should(() => {
				class A {

					@Singleton
					a() {}

				}
			}).throw(/only applicable to classes/);
		});

		it('should guarantee @Singleton decorated classes are singletons', () => {

			@Singleton
			class B {}

			class A {
				@Inject(B)
				a;
			}

			let container	= new Container(),
				a			= container.create(A),
				b			= container.create(B);

			a.a.should.equal(b);
			b.should.equal(container.create(B));
		});

	});

	describe('@Abstract', () => {

		it('should not allow instantiation of @Abstract classes', () => {

			@Abstract
			class A {}

			should(() => new Container().create(A))
				.throw(/abstract/);
		});

		it('should allow instantiation of subclasses of @Abstract', () => {

			@Abstract
			class A {}
			class B extends A {}

			should(() => new Container().create(B))
				.not.throw(/abstract/);
		});

		it('should throw for members that are not methods', () => {

			should(() => {
				class A {

					@Abstract
					a = 7;

				}
			}).throw(/Only classes or methods/);
		});

		it('should cause methods to throw if invoked', () => {

			class A {

				@Abstract
				a() {}

			}

			should(() => new A().a())
				.throw(/abstract/);
		});

		it('should prevent instantiation of classes if applied to methods', () => {

			class A {

				@Abstract
				a() {}

			}

			should(() => new Container().create(A))
				.throw(/abstract/);
		});

	});

	describe('@Init', () => {

		it('should throw if not applied to class member', () => {
			should(() => {
				@Init
				class A {}
			}).throw(/only applicable to instance methods/);
		});

		it('should throw if not a method', () => {
			should(() => {
				class A {
					@Init
					a;
				}
			}).throw(/only declare methods/);
		});

		it('should cause the method decorated to be called after injection', () => {
			let called = false;
			class A {}
			class B {

				@Inject(A)
				a;

				@Init
				b() { called = this.a; }

			}
			let instance = new Container().create(B);
			called.should.be.instanceof(A);
			instance.a.should.be.instanceof(A);
		});

		it('should throw if more than one init specified', () => {
			should(() => {
				class A {
					@Init
					a() {}

					@Init
					b() {}
				}
			}).throw(/may only have one/);
		});

	});

	describe('@Inject', () => {

		it('should inject into constructor parameters', () => {
			let called = false;

			class A {}

			@Inject(A)
			class B {

				constructor(...params) {
					called = params;
				}
			}
			let instance = new Container().create(B);
			called.should.eql([ new A() ]);
		});

		it('should inject multiple constructor parameters', () => {
			let called = false;

			class A {}
			class B {}

			@Inject(A, B)
			class C {

				constructor(...params) {
					called = params;
				}
			}
			let instance = new Container().create(C);
			called.should.eql([ new A(), new B() ]);
		});

		it('should throw on multiple constructor injections', () => {
			let called = false;

			class A {}
			class B {}

			should(() => {

				@Inject(A, B)
				@Inject(B, A)
				class C {}

			}).throw(/only specify one injection/);
		});

		it('should inject into instance properties', () => {
			class A {}

			class B {

				@Inject(A)
				a;

			}
			let instance = new Container().create(B);
			instance.a.should.be.instanceof(A);
		});

		it('should only allow single params for property injections', () => {
			should(() => {
				class A {}
				class B {
					@Inject(A, A)
					a;
				}
			}).throw(/only specify one parameter/);
		});

		it('should inject into setter methods', () => {
			let called = false;

			class A {}

			class B {

				@Inject(A)
				a(value) { called = value; }

			}
			let instance = new Container().create(B);
			called.should.be.instanceof(A);
		});

		it('should inject multiple params into setter methods', () => {
			let called = false;

			class A {}
			class B {}

			class C {

				@Inject(A, B)
				a(a, b) { called = [ a, b ]; }

			}
			let instance = new Container().create(C);
			called.should.eql([ new A(), new B() ]);
		});

		it('should respect inherited injections', () => {
			class A {}

			class B {
				@Inject(A)
				a;
			}

			class C extends B {
				@Inject(A)
				b;
			}

			let result = new Container().create(C);

			result.should.be.instanceOf(C);
			result.should.be.instanceOf(B);

			result.a.should.be.instanceOf(A);
			result.b.should.be.instanceOf(A);

		});

		it('should suppress overriden inherited injections', () => {
			class A {}
			class B {}

			class C {
				@Inject(A)
				a;
			}

			class D extends C {
				@Inject(B)
				a;
			}

			let result = new Container().create(D);

			result.should.be.instanceOf(D);
			result.should.be.instanceOf(C);

			result.a.should.be.instanceOf(B);

		});

		it('should inject destructured dependencies into all the things', () => {

			class A {}
			class B {}
			class C {}

			@Inject({ a: [ A, B, C ], b: { a: A }}, [ B, C ])
			class D {

				constructor(a, b) {
					this.construct = [ a, b ];
				}

				@Inject({ A }, [ B, A ], C)
				a(a, b, c) { this.setter = [ a, b, c ]; }

				@Inject(C)
				b;

			}
			let instance = new Container().create(D);

			instance.should.be.instanceof(D);
			instance.b.should.be.instanceof(C);
			instance.construct.should.eql([ { a: [ new A(), new B(), new C() ], b: { a: new A() } }, [ new B(), new C() ] ]);
			instance.setter.should.eql([ { A: new A() }, [ new B(), new A() ], new C() ]);
		});

	});

});
