var util = require('util');

// Try to make sense of data in properties, and safe guard in cases
// where a defined getter (ie. Object.prototype.__defineGetter__())
// would throw an error and cause the JSON stringify step to fail.
function safeGuard(data, key) {
	if (typeof data === 'object') {
		var propertyDescriptor = Object.getOwnPropertyDescriptor(data, key);
		if (propertyDescriptor && typeof propertyDescriptor.get === 'function') {
			try {
				return data[key];
			}
			catch(err) {
				return handleError(err);
			}
		}
	    return data[key];
	}

	return data;
}

function handleError(err) {
	var data = {
		name: err.name,
		stack: err.stack,
		message: err.message
	};
	for (var property in err) {
		data[property] = safeGuard(err, property);
	}
	return data;
}

function isComplexObject(data) {
	return data &&
		typeof data === 'object' &&
		!util.isArray(data) &&
		Object.getPrototypeOf(data) !== Object.prototype
	;
}

function isComplexType(data) {
	return typeof data !== 'object' ||
		util.isArray(data) ||
		data instanceof Date ||
		Buffer.isBuffer(data)
	;
}

// Recursively collect data from the passed in data object.
// `level` is an iterator to avoid exceeding the stack size
function SafeObject(config) {
	this.maxNestingDepth = (typeof config.maxNestingDepth === 'number' && config.maxNestingDepth > 0 ?
		config.maxNestingDepth :
		5
    );
	this.maxWidth = config.maxWidth;
	this.shouldOutputJSON = (typeof config.shouldOutputJSON === 'boolean' ?
		config.shouldOutputJSON :
		true
	);

	this.ignoreUnderscore = (typeof config.ignoreUnderscore === 'boolean' ?
		config.ignoreUnderscore:
		false
	);
}

SafeObject.prototype.hoistData = function(data, level) {
	var rtn = {};
	level = level || 0;

	if (level > this.maxNestingDepth) {
		return '[too deeply nested]';
	} 
	else if (util.isError(data)) {
		rtn = handleError(data);
	}
	else if (level === 0 && isComplexType(data)) {
		data = { data: data };
	}
	else if (data instanceof Date) {
		try {
			rtn = data.toString();
		}
		catch(err) {
			rtn = handleError(err);
		}
	}
	else if (level && isComplexObject(data)) {
		return '[COMPLEX Object]';
	}
	else if (util.isArray(data)) {
		rtn = [];
		// guard for potential getters on array indicies that throw errors
		var len = (data.length > this.maxWidth) ? this.maxWidth : data.length;

		for (var i = 0; i < len; i += 1) {
			rtn.push(this.hoistData(safeGuard(data, i), level + 1));
		}
	}

	var current;
	var iterator = 0;
	for (var property in data) {
		if (this.maxWidth && iterator >= this.maxWidth) {
			break;
		}

		if (this.ignoreUnderscore && property[0] === '_') {
			continue;
		}

		if (this.shouldOutputJSON && property === 'toJSON' && typeof data[property] === 'function') {
			try {
				rtn.__json_output = data.toJSON();
			}
			catch (err) {
				rtn.__json_output = handleError(err);
			}
			continue;
		}

		current = safeGuard(data, property);
		if (typeof current === 'object') {
			rtn[property] = this.hoistData(current, level + 1);
		}
		else {
			rtn[property] = current;
		}

		iterator += 1;
	}

	return rtn;
};


module.exports = function(config) {
	var hoist = new SafeObject(config);
	return hoist.hoistData.bind(hoist);
};
