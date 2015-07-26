var ParsletError = module.exports.ParsletError = function() {
	Error.apply(this, Array.prototype.slice.call(arguments));
};
ParsletError.prototype = Object.create(Error.prototype);
ParsletError.prototype.constructor = ParsletError;


var TokenWrapper = module.exports.TokenWrapper = function(tokens) {
	this.tokens = tokens;
	this.length = tokens.length;
	this.pos = 0;
	this.stack = [];
};
TokenWrapper.prototype.constructor = TokenWrapper;

TokenWrapper.prototype.peek = function() {
	return this.tokens[this.pos];
};

TokenWrapper.prototype.eof = function() {
	return this.pos >= this.length;
};

TokenWrapper.prototype.consume = function(form) {
	var args = Array.prototype.slice.call(arguments);

	if (this.eof()) {
		throw new ParsletError();
	}

	if (typeof form === 'undefined') {
		return this.tokens[this.pos++];
	} else if (typeof form === 'string') {

		var field = 'lexeme';

		if (form.charAt(0) === ':' && form.length !== 1) {
			form = form.substr(1);
			field = 'tag';
		}

		if (this.tokens[this.pos][field] === form) {
			return this.tokens[this.pos++];
		} else {
			throw new ParsletError();
		}

	} else if (typeof form === 'function') {
		for (var i = 0; i < args.length; i++) {
			var index;

			try {
				index = this.pos;

				return args[i].apply(this);
			} catch(e) {
				if (e instanceof ParsletError) {
					this.pos = index;

					if (i == args.length -1) {
						throw e;	
					}
				} else {
					throw e;
				}
			}
		}
	}
};

TokenWrapper.prototype.consumeIf = function() {
	var index = this.pos;

	try {
		return this.consume.apply(this, Array.prototype.slice.call(arguments));
	} catch(e) {
		if (e instanceof ParsletError) {
			this.pos = index;

			return null;
		} else {
			throw e;
		}
	}
};

TokenWrapper.prototype.is = function() {
	var index = this.pos;

	try {
		this.consume.apply(this, Array.prototype.slice.call(arguments));
	} catch(e) {
		if (e instanceof ParsletError) {
			return false;
		} else {
			throw e;
		}
	} finally {
		this.pos = index;
	}

	return true;
};

var lValue = module.exports.lValue = function() {
	return this.consume(function() {
		return this.consume(':decimalLiteral');
	}, function() {
		return this.consume(':stringLiteral');
	}, function() {
		return this.consume(':identifier');
	});
};

var rValue = module.exports.rValue = function() {
	return this.consume(':identifier');
};

var sequence = module.exports.sequence = function(parslet) {
	return function() {
		var sequence = [],
			item;

		while(item = this.consumeIf(parslet)) {
			sequence.push(item);
		}

		if (!sequence.length) {
			throw new ParsletError();
		}

		return sequence;
	}
};

var search = module.exports.search = function(parslet) {
	return function() {
		var sequence = [],
			item;

		while(!this.eof()) {
			item = this.consumeIf(parslet);

			if (item) {
				sequence.push(item);
			} else {
				this.consume();
			}
		}

		return sequence;
	};
};

var formalArgs = module.exports.formalArgs = function() {
	var arguments = [];

	this.consume('(');

	while(!this.consumeIf(')')) {
		var argument = this.consume(':identifier'),
			defaultValue;

		if (this.consumeIf(':')) {
			defaultValue = this.consume(lValue);
		}

		this.consumeIf(',');

		arguments.push({
			name: argument,
			defaultValue: defaultValue
		});
	}

	return arguments;
};

var actualArgs = module.exports.actualArgs = function(options) {
	var arguments = [];

	this.consume('(');

	while(!this.consumeIf(')')) {
		arguments.push(this.consume(arith(options)));

		this.consumeIf(',');
	}

	return arguments;
};

var arith = module.exports.arith = function(options) {
	options = options || {};
	options.postfixOps = options.postfixOps || ['++', '--'];
	options.unaryOps = options.unaryOps || ['++', '--', '+', '-'];

	var additiveExpression = function() {
		var expr = this.consume(multiplicativeExpression);

		while(!this.eof() && ['+', '-'].indexOf(this.peek().lexeme) !== -1) {
			expr = {
				type: 'binary',
				left: expr,
				op: this.consume(':operator'),
				right: this.consume(multiplicativeExpression)
			}
		}

		return expr;
	};

	var multiplicativeExpression = function() {
		var expr = this.consume(unaryExpression);

		while(!this.eof() &&['*', '/'].indexOf(this.peek().lexeme) !== -1) {
			expr = {
				type: 'binary',
				left: expr,
				op: this.consume(':operator'),
				right: this.consume(unaryExpression)
			}
		}

		return expr;
	};

	var unaryExpression = function() {
		var op = this.consumeIf(':operator');

		var index = this.pos;

		if (op) {
			if (options.unaryOps.indexOf(op.lexeme) !== -1) {
				return {
					type: 'unary',
					op: op,
					expr: this.consume(unaryExpression)
				};
			} else {
				this.pos = index;
			}
		}

		return this.consume(postfixExpression);
	};

	var postfixExpression = function() {
		var expr, op;

		if (this.consumeIf('(')) {
			expr = this.consume(additiveExpression);
			this.consume(')');
		} else {
			expr = this.consume(lValue);
		}

		var index = this.pos;

		if (op = this.consumeIf(':operator')) {
			if (options.postfixOps.indexOf(op.lexeme) !== -1) {
				return {
					type: 'postfix',
					op: op,
					expr: expr
				}
			} else {
				this.pos = index;
			}
		}

		return expr;
	};

	return function() {
		return this.consume(additiveExpression);
	};
};