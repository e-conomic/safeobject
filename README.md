Safe Object
===========
Copy data from an object in a safe way. Make a rouge object ready for JSON-stringify. Read more about the problems this project aims to solve in the *the problem*-section in this readme file.


## install
Safe object is available from NPM.

```sh
npm install safeobject --save
```

Please read the configuration section for configuration and usage examples.


## Configuration
Before the module is used it has to be initalized with a configuration object. The following configuration settings are supported:

  * `maxWidth` default `undefined`. Defines a max width when visiting arrays and objects, if it is set to `3` it will only visit the first three elements from arrays and objects.
  * `maxNestingDepth` default `5`. Defines how deep structures will be visited. This is required as it will prevent circular references from exceeding the stack size.
  * `shouldOutputJSON` whether or not to run toJSON methods. If it is run it will output to the `__json_output`-key on the returned object.
  * `ignoreUnderscore` default `false`. Wheter or not to ignore keys starting with `_`.

Example, to ignore underscores and change the max nesting depth it could be required like this:

```js
var safeObject = require('safeObject')({
    ignoreUnderscore: true,
	maxNestingDepth: 10
});
```

From then on you can pass objects to `safeObject` which will return the data from the object.

```js
JSON.stringify(safeObject({foo: 'bar'}));
```


## The problems
The following describes the problems this project aim to solve.


### Object properties with defined getters
If we have an object that implements a getter with the old and now depricated `Object.prototype.__defineGetter__` function:

```js
var obj = {};
obj.__defineGetter__('foo', function() {
    return 'bar';
});
JSON.stringify(obj) // {"foo": "bar"}
```

This is all good, `JSON.stringify` will return `{"foo": "bar"}` as expected. But what will happen if the defined getter throws an error?

```js
var obj = {};
obj.__defineGetter__('foo', function() {
    throw new Error('oh noes!');
});
JSON.stringify(obj) // error thrown!
```

This module will try to catch these cases, and return the stack trace from the rouge getter:

```js
JSON.stringify(safeObject(obj));
'{"foo":{"name":"Error","stack":"Error: oh noes!\\n    at Object.foo (repl:2:7)\\n    at safeGuard (/Users/martin/Development/e-conomic/safe-object/index.js:11:16)\\n    at hoistData (/Users/martin/Development/e-conomic/safe-object/index.js:98:13)\\n    at repl:1:16\\n    at REPLServer.self.eval (repl.js:110:21)\\n    at repl.js:249:20\\n    at REPLServer.self.eval (repl.js:122:7)\\n    at Interface.<anonymous> (repl.js:239:12)\\n    at Interface.EventEmitter.emit (events.js:95:17)\\n    at Interface._onLine (readline.js:202:10)","message":"oh noes!"}}'
```

### Handling circular references
JSON stringify will throw a type error if you try to parse an object that contain a reference to itself or another key within the object.

```js
var obj = {};
obj.a = obj;
JSON.stringify(obj); // TypeError: Converting circular structure to JSON
```

This situation is, for the time being, handled by specifying a maximum nesting level, which is set to five levels by default.

```js
var obj = {};
obj.a = obj;
JSON.stringify(safeObject(obj)); // '{"a":{"a":{"a":{"a":{"a":{"a":"[too deeply nested]"}}}}}}'
```

The nesting level can be set with the configuration key `maxNestingDepth`.


### "Complex" object handling
Objects that has another prototype than Object.prototype will not be visited.

```js
var obj = {data: global};
JSON.stringify(safeObject(obj)); // '{"data": "[COMPLEX Object]"}'
```

This should make it safe to log data structures that include a reference to the global object.


## License
The MIT License (MIT)

Copyright (c) 2014 E-conomic

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
