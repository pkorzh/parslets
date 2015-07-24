var ParsletCombinator = module.exports.ParsletCombinator = function() {
	this.parslets = Array.prototype.slice.call(arguments);

	var combinator = this;

	this.parsletContext = {
		consume: function(form) {
			var ret = null;

			if (typeof form === 'function') {
				return (new ParsletCombinator(form)).parse(combinator.tokens);
			} else if (form instanceof ParsletCombinator) {
				return form.parse(combinator.tokens);
			} else if (typeof form === 'undefined') {
				return combinator.tokens[combinator.tokens.index++];
			} else {
				var field = 'lexeme';

				if (form.charAt(0) === ':' && form.length !== 1) {
					form = form.substr(1);
					field = 'tag'
				}

				if (combinator.tokens[combinator.tokens.index][field] === form) {
					return combinator.tokens[combinator.tokens.index++];
				} else {
					throw new Error('Expected ' + form + ' got ' + combinator.tokens[combinator.tokens.index][field]);
				}
			}
		},
		consumeIf: function(form) {
			try {
				return this.consume(form);
			} catch (e) {
				return null;
			}
		},
		nextIs: function(form) {
			var index = combinator.tokens.index;

			try {
				combinator.tokens.index++;

				this.consume(form);
			} catch (e) {
				return false;
			} finally {
				combinator.tokens.index = index;
			}

			return true;
		},
		peek: function() {
			return combinator.tokens[combinator.tokens.index];
		},
		eof: function() {
			return combinator.tokens.index >= combinator.tokens.length;
		},
		rewind: function() {
			combinator.tokens.index--;	
		},
	}
};

ParsletCombinator.prototype.parse = function(tokens) {
	this.tokens = tokens;
	this.tokens.index = this.tokens.index || 0;

	var index = this.tokens.index;

	for (var i = 0; i < this.parslets.length; i++) {
		try{
			var obj = this.parslets[i].apply(this.parsletContext);

			if (obj instanceof ParsletCombinator) {
				return obj.parse(this.tokens);
			} else {
				return obj;
			}
		} catch(e) {
			this.tokens.index = index;
		}
	}
};

var namedArgumentsParslet = module.exports.namedArgumentsParslet = function() {
	var arguments = [];

	this.consume('(');

	while(!this.consumeIf(')')) {
		var ident = this.consume(':identifier'),
			value = null;

		if (this.consumeIf(':')) {
			value = this.consume(lValueParslet);
		}

		arguments.push({
			name: ident,
			value: value
		});

		this.consumeIf(',');
	}

	return arguments;
};

var positionalArgumentsParslet = module.exports.positionalArgumentsParslet = function() {
	var arguments = [];

	this.consume('(');

	while(!this.consumeIf(')')) {
		arguments.push(this.consume(lValueParslet));

		this.consumeIf(',');
	}

	return arguments;
};

var lValueParslet = module.exports.lValueParslet = function() {
	return new ParsletCombinator(function() {
		return this.consume(':decimalLiteral');
	}, function() {
		return this.consume(':stringLiteral');
	}, function() {
		return this.consume(':identifier');
	});
};

var rValueParslet = module.exports.lValueParslet = function() {
};

var arith = module.exports.arith = function(options) {
	options.postfixOps = options.postfixOps || ['++', '--'];
	options.unaryOps = options.unaryOps || ['++', '--'];

	var root = {};

	var additiveExpressionParslet = root.additiveExpressionParslet = function() {
		var expr = this.consume(multiplicativeExpressionParslet);

		while(!this.eof() && ['+', '-'].indexOf(this.peek().lexeme) !== -1) {
			expr = {
				type: 'binary',
				left: expr,
				op: this.consume(':operator'),
				right: this.consume(multiplicativeExpressionParslet)
			}
		}

		this.consumeIf(';')

		return expr;
	};

	var multiplicativeExpressionParslet = root.multiplicativeExpressionParslet = function() {
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

	var unaryExpressionParslet = root.unaryExpressionParslet = function() {
		var op = this.consumeIf(':operator');

		if (op) {
			return {
				type: 'unary',
				op: op,
				expr: this.consume(unaryExpressionParslet)
			};
		} else {
			return this.consume(postfixExpressionParslet);
		}
	};

	var postfixExpressionParslet = root.postfixExpressionParslet = function() {
		var expr = this.consume(lValueParslet);
		var op = this.consumeIf(':operator');

		if (op && options.postfixOps.indexOf(op.lexeme) !== -1) {
			return {
				type: 'postfix',
				op: op,
				expr: expr
			}
		} else {
			return expr;
		}
	};

	return root;
}