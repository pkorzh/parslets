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
		this.mark();

		for (var i = 0; i < args.length; i++) {
			try {
				return args[i].apply(this);
			} catch(e) {
				if (e instanceof ParsletError) {
					this.restore();

					if (i === args.length -1) {
						throw e;
					}
				} else {
					throw e;
				}
			}
		}
	}
};

TokenWrapper.prototype.consumeIf = function(form) {
	this.mark();

	try {
		return this.consume(form);
	} catch(e) {
		if (e instanceof ParsletError) {
			this.restore();

			return null;
		} else {
			throw e;
		}
	}
};

TokenWrapper.prototype.is = function(form) {
	this.mark();

	try {
		this.consume(form);
	} catch(e) {
		if (e instanceof ParsletError) {
			return false;
		} else {
			throw e;
		}
	} finally {
		this.restore();
	}

	return true;
};

TokenWrapper.prototype.mark = function() {
	this.stack.unshift(this.pos);
};

TokenWrapper.prototype.restore = function() {
	this.pos = this.stack.shift();
};

var lValueParslet = module.exports.lValueParslet = function() {
	return this.consume(function() {
		return this.consume(':decimalLiteral');
	}, function() {
		return this.consume(':stringLiteral');
	}, function() {
		return this.consume(':identifier');
	});
};

var rValueParslet = module.exports.rValueParslet = function() {
	return this.consume(':identifier');
};

var sequenceParslet = module.exports.sequenceParslet = function(skip, parslet) {
	return function() {
		var sequence = [],
			item;

		while(!this.eof()) {
			item = this[skip ? 'consumeIf' : 'consume'](parslet);

			if (item) {
				sequence.push(item)
			} else {
				this.consume();
			}
		}

		return sequence;
	};
};

var formalArgsParslet = module.exports.formalArgsParslet = function() {
	var arguments = [];

	this.consume('(');

	while(!this.consumeIf(')')) {
		var argument = this.consume(':identifier'),
			defaultValue;

		if (this.consumeIf(':')) {
			defaultValue = this.consume(lValueParslet);
		}

		this.consumeIf(',');

		arguments.push({
			argument: argument,
			defaultValue: defaultValue
		});
	}

	return arguments;
};

var actualArgsParslet = module.exports.actualArgsParslet = function(options) {
	var arguments = [];

	this.consume('(');

	while(!this.consumeIf(')')) {
		arguments.push({argument: this.consume(arith(options))});

		this.consumeIf(',');
	}

	return arguments;
};

var arith = module.exports.arith = function(options) {
	options = options || {};
	options.postfixOps = options.postfixOps || ['++', '--'];
	options.unaryOps = options.unaryOps || ['++', '--', '+', '-'];

	var additiveExpressionParslet = function() {
		var expr = this.consume(multiplicativeExpressionParslet);

		while(!this.eof() && ['+', '-'].indexOf(this.peek().lexeme) !== -1) {
			expr = {
				type: 'binary',
				left: expr,
				op: this.consume(':operator'),
				right: this.consume(multiplicativeExpressionParslet)
			}
		}

		return expr;
	};

	var multiplicativeExpressionParslet = function() {
		var expr = this.consume(unaryExpressionParslet);

		while(!this.eof() &&['*', '/'].indexOf(this.peek().lexeme) !== -1) {
			expr = {
				type: 'binary',
				left: expr,
				op: this.consume(':operator'),
				right: this.consume(unaryExpressionParslet)
			}
		}

		return expr;
	};

	var unaryExpressionParslet = function() {
		var op = this.consumeIf(':operator');

		this.mark();

		if (op) {
			if (options.unaryOps.indexOf(op.lexeme) !== -1) {
				return {
					type: 'unary',
					op: op,
					expr: this.consume(unaryExpressionParslet)
				};
			} else {
				this.restore();
			}
		}

		return this.consume(postfixExpressionParslet);
	};

	var postfixExpressionParslet = function() {
		var expr, op;

		if (this.consumeIf('(')) {
			expr = this.consume(additiveExpressionParslet);
			this.consume(')');
		} else {
			expr = this.consume(lValueParslet);
		}

		this.mark();

		if (op = this.consumeIf(':operator')) {
			if (options.postfixOps.indexOf(op.lexeme) !== -1) {
				return {
					type: 'postfix',
					op: op,
					expr: expr
				}
			} else {
				this.restore();
			}
		}

		return expr;
	};

	return function() {
		return this.consume(additiveExpressionParslet);
	};
};