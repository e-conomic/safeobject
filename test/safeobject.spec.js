var safeObject = require('../index');
var util = require('util');

describe('safeobject.spec.js', function() {
	var hoistData;
	beforeEach(function() {
		hoistData = safeObject({});
	});

	describe('when hoisting data from an object with errors', function() {
		var error;
		beforeEach(function() {
			error = new Error('Boom!');
		});

		it('should extract message from the error', function() {
			expect(hoistData(error).message).to.equal('Boom!');
		});

		it('should extract data from errors', function() {
			expect(hoistData(error)).to.contain.keys('name', 'stack', 'message');
		});

		it('should extract extra data from errors', function() {
			error.foo = 'bar';
			expect(hoistData(error).foo).to.equal('bar');
		});
	});

	describe('when hoisting data from an object that has a defined getter', function() {
		describe('that has valid return data', function() {
			var foo;
			beforeEach(function() {
				foo = { bar: 'baz' };
				foo.__defineGetter__('bar', function(){
					return 'foo';
				});
			});

			it('should successfully fetch the data', function() {
				expect(hoistData(foo)).to.eql({bar: 'foo'});
			});
		});

		describe('that throws an error', function() {
			var bar;
			beforeEach(function() {
				// this code is from something that happened in production
				// using the express 3.3.8 module. The headers had, for some
				// reason become `undefined` and the getters started throwing
				// errors
				var get = function(name){
					return undefined[name];
				};
				bar = {};
				bar.__defineGetter__('acceptedEncodings', function(){
					var accept = get('Accept-Encoding');
					return accept ? accept.trim().split(/ *, */) : [];
				});
			});

			it('should not die horribly if the property throws an error', function() {
				expect(function() {hoistData(bar);}).to.not.throw();
			});

			it('should not die horribly if a nested property throws an error', function () {
				expect(function() {hoistData({ bar: bar });}).to.not.throw();
			});

			it('should not die if an object has an array with a property that has a throwing getter', function(){
				var foo = {
					message: 'foo',
					bar: ['baz', [bar]]
				};
				expect(function(){ hoistData(foo); }).to.not.throw();
			});

			it('should not die if an array has a defined property getter that throws an error', function() {
				var foo = ['foo', 'bar', 'baz'];
				foo.__defineGetter__(1, function() {
					undefined['foo bar'] = 'oh my!';
				});
				expect(function(){hoistData(foo);}).to.not.throw();
			});
		});

		describe('that is an error', function(){
			var error = new Error('oh my');
			error.__defineGetter__('foo', function() {
				return undefined['foo bar'];
			});

			it('should not throw an error', function() {
				expect(hoistData(error)).to.be.ok;
			});
		});

	});

	describe('when hoisting data from nested messages', function () {
		it('not throw an error if data is null', function() {
			expect(function() {hoistData({data: null});}).to.not.throw();
		});

		it('should stop at some point to avoid exceeding the stack size', function() {
			function crawl(leaf) {
				if (typeof leaf === 'object') {
					return crawl(leaf.data);
				}
				return leaf;
			}
			var data = {};
			data.data = data;
			expect(crawl(hoistData(data))).to.equal('[too deeply nested]');
		});

		it('should stop at some point to avoid exceeding the stack size when visiting arrays', function() {
			function crawl(leaf) {
				if (util.isArray(leaf)) {
					return crawl(leaf[0]);
				}
				return leaf;
			}

			function createDeeplyNestedArray(levels) {
				return (function createLeaf(i) {
					return i > 1 ? [createLeaf(i - 1)] : [];
				})(levels);
			}

			expect(crawl(hoistData(createDeeplyNestedArray(100)).data)).to.equal('[too deeply nested]');
		});

		it('should be able to limit the entries it would visit in an array', function() {
			hoistData = safeObject({
				maxWidth: 5
			});
			expect(hoistData([1,2,3,4,5,6,7,8,9,10]).data.length).to.equal(5);
		});
	});

	describe('when objects has .toJSON functions', function() {
		it('should run the json method and store the output', function () {
			var data = {
				toJSON: function() {
					return { foo: 'bar' };
				}
			};
			expect(hoistData(data).__json_output).to.eql({foo: 'bar'});
		});

		it('should save the json output to __json_output and return the rest of the data', function () {
			var data = { bar: 'baz', baz: 'qux',
				toJSON: function() {
					return { foo: 'bar' };
				}
			};
			expect(hoistData(data)).to.eql({
				bar: 'baz',
				baz: 'qux',
				__json_output: { foo: 'bar' }
			});
		});

		it('should hoist the error if the toJSON function throws an error', function () {
			var data = {
				toJSON: function() {
					undefined['oh noes'] = 'ouch!';
					return { foo: 'bar' };
				}
			};
			expect(hoistData(data).__json_output).to.contain.keys('name', 'stack', 'message');
		});
	});

	describe('when hoisting data from an object', function() {
		it('should not modify the passed in message object', function() {
			var obj = { foo: 'foo', bar: 'bar', baz: 'baz' };
			hoistData(obj);
			expect(obj).to.eql({ foo: 'foo', bar: 'bar', baz: 'baz' });
		});

		describe('with a property of the type function', function() {
			var obj = {
				foo: function() {}
			};
			it('should not throw', function() {
				expect(function(){hoistData(obj);}).to.not.throw();
			});
		});

		describe('with functions set on its .prototype', function() {
			var Test;
			beforeEach(function() {
				Test = function() {};
				Test.prototype.foo = function() {};
			});

			it('should not throw an exception', function() {
				expect(function(){hoistData(new Test());}).to.not.throw();
			});
		});

		describe('that is a date', function() {
			it('should return a stringified representation', function() {
				var date = new Date();
				expect(hoistData(date)).to.eql({data: date.toString()});
			});

			it('should return "Invalid Date" if the date is invalid', function() {
				expect(hoistData(new Date('foo'))).to.eql({data: 'Invalid Date'});
			});
		});

		describe('when visiting complex objects', function() {
			it('should return [COMPLEX Object]', function() {
				expect(hoistData({data: global})).to.eql({data: '[COMPLEX Object]'});
			});
		});

		describe('and dealing with properties that start with underscores', function() {
			it('it should not visit them if they are ignored', function() {
				hoistData = safeObject({ignoreUnderscore: true});
				expect(hoistData({_: 'foo', _bar: 'bar'})).to.eql({});
			});
			it('it should not visit them if they are not ignored', function() {
				hoistData = safeObject({ignoreUnderscore: false});
				expect(hoistData({_: 'foo', _bar: 'bar'})).to.eql({_: 'foo', _bar: 'bar'});
			});
		});

	});
});
