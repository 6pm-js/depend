import should from 'should';

import { Container, Init, Inject } from '../lib/depend.js';



describe('Promise', () => {


	describe('Container.create on constructor promise', () => {

		it('should return a promise that resolves on init complete', () => {
			let called = false;

			class B {
				constructor() {
					return new Promise((resolve, reject) => {
						resolve(this);
					});
				}

				@Init
				init() {
					called = true;
				}

			}

			let result = new Container().create(B);

			result.should.be.instanceof(Promise);
			called.should.equal(false);

			return result.then(function(resolved) {
				resolved.should.be.instanceof(B);
				called.should.equal(true);
			});
		});

		it('should return a promise that rejects on failure', () => {

			class B {
				constructor() {
					return new Promise((resolve, reject) => {
						reject(new Error('failed'));
					});
				}
			}

			let result = new Container().create(B);

			result.should.be.instanceof(Promise);

			return result.then(function(resolve) {
				throw new Error('Should not resolve');
			}).catch(function(error) {
				error.message.should.match(/failed/);
			});
		});

	});

	describe('Container.create on setter injection that returns a promise', () => {

		it('should return a promise that resolves on init complete', () => {
			class A {}

			class B {

				@Inject(A)
				injectA(a) {
					return new Promise((resolve, reject) => {
						this.a = a;
						resolve();
					});
				}

			}

			let result = new Container().create(B);

			result.should.be.instanceof(Promise);
			should(result.a).be.undefined;

			return result.then(function(resolved) {
				resolved.should.be.instanceof(B);
				resolved.a.should.be.instanceof(A);
			});
		});

		it('should return a Promise that rejects on setter rejection', () => {
			class A {}

			class B {

				@Inject(A)
				injectA(a) {
					return new Promise((resolve, reject) => {
						reject(new Error('setter failed'));
					});
				}

			}

			let result = new Container().create(B);

			result.should.be.instanceof(Promise);

			return result.then(function(resolve) {
				throw new Error('Should not resolve');
			}).catch(function(error) {
				error.message.should.match(/setter failed/);
			});
		});

	});

	describe('Container.create on init promise', () => {

		it('should return a Promise that resolves on init complete', () => {
			class B {

				@Init
				init() {
					return new Promise((resolve, reject) => {
						resolve();
					});
				}

			}

			let result = new Container().create(B);

			result.should.be.instanceof(Promise);

			return result.then(function(resolved) {
				resolved.should.be.instanceof(B);
			});
		});

		it('should return a Promise that rejects on init failure', () => {
			class B {

				@Init
				init() {
					return new Promise((resolve, reject) => {
						reject(new Error('init failed'));
					});
				}

			}

			let result = new Container().create(B);

			result.should.be.instanceof(Promise);

			return result.then(function(resolve) {
				throw new Error('Should not resolve');
			}).catch(function(error) {
				error.message.should.match(/init failed/);
			});
		});

	});

	describe('Container.create with all the Promises', () => {

		it('should return a Promise that resolves in correct order', () => {
			let state = 'preinit';

			class A {}

			class B {

				constructor() {
					return new Promise((resolve, reject) => {
						try{
							state.should.equal('preinit');
							state = 'constructed';
						}catch(e) {
							reject(e);
						}
						resolve(this);
					});
				}

				@Inject(A)
				setA(a) {
					return new Promise((resolve, reject) => {
						try{
							state.should.equal('constructed');
							state = 'aset';
						}catch(e) {
							reject(e);
						}
						resolve(this);
					});
				}

				@Init
				init() {
					return new Promise((resolve, reject) => {
						try{
							state.should.equal('aset');
							state = 'inited';
						}catch(e) {
							reject(e);
						}
						resolve(this);
					});
				}

			}

			let result = new Container().create(B);

			result.should.be.instanceof(Promise);

			return result.then(function(resolved) {
				resolved.should.be.instanceof(B);
				state.should.equal('inited');
			});
		});

		it('should return a Promise that rejects on constructor fail', () => {
			let state = 'preinit';

			class A {}

			class B {

				constructor() {
					return new Promise((resolve, reject) => {
						try{
							state.should.equal('preinit');
							state = 'constructed';
						}catch(e) {
							reject(e);
						}
						reject(new Error('constructor fail'));
					});
				}

				@Inject(A)
				setA(a) {
					return new Promise((resolve, reject) => {
						try{
							state.should.equal('constructed');
							state = 'aset';
						}catch(e) {
							reject(e);
						}
						resolve(this);
					});
				}

				@Init
				init() {
					return new Promise((resolve, reject) => {
						try{
							state.should.equal('aset');
							state = 'inited';
						}catch(e) {
							reject(e);
						}
						resolve(this);
					});
				}

			}

			let result = new Container().create(B);

			result.should.be.instanceof(Promise);

			return result.then(function(resolve) {
				throw new Error('Should not resolve');
			}).catch(function(error) {
				state.should.equal('constructed');
				error.message.should.match(/constructor fail/);
			});
		});

		it('should return a Promise that rejects on setter fail', () => {
			let state = 'preinit';

			class A {}

			class B {

				constructor() {
					return new Promise((resolve, reject) => {
						try{
							state.should.equal('preinit');
							state = 'constructed';
						}catch(e) {
							reject(e);
						}
						resolve(this);
					});
				}

				@Inject(A)
				setA(a) {
					return new Promise((resolve, reject) => {
						try{
							state.should.equal('constructed');
							state = 'aset';
						}catch(e) {
							reject(e);
						}
						reject(new Error('setter fail'));
					});
				}

				@Init
				init() {
					return new Promise((resolve, reject) => {
						try{
							state.should.equal('aset');
							state = 'inited';
						}catch(e) {
							reject(e);
						}
						resolve(this);
					});
				}

			}

			let result = new Container().create(B);

			result.should.be.instanceof(Promise);

			return result.then(function(resolve) {
				throw new Error('Should not resolve');
			}).catch(function(error) {
				state.should.equal('aset');
				error.message.should.match(/setter fail/);
			});
		});

		it('should return a Promise that rejects on init fail', () => {
			let state = 'preinit';

			class A {}

			class B {

				constructor() {
					return new Promise((resolve, reject) => {
						try{
							state.should.equal('preinit');
							state = 'constructed';
						}catch(e) {
							reject(e);
						}
						resolve(this);
					});
				}

				@Inject(A)
				setA(a) {
					return new Promise((resolve, reject) => {
						try{
							state.should.equal('constructed');
							state = 'aset';
						}catch(e) {
							reject(e);
						}
						resolve();
					});
				}

				@Init
				init() {
					return new Promise((resolve, reject) => {
						try{
							state.should.equal('aset');
							state = 'inited';
						}catch(e) {
							reject(e);
						}
						reject(new Error('init fail'));
					});
				}

			}

			let result = new Container().create(B);

			result.should.be.instanceof(Promise);

			return result.then(function(resolve) {
				throw new Error('Should not resolve');
			}).catch(function(error) {
				state.should.equal('inited');
				error.message.should.match(/init fail/);
			});
		});

	});

});
