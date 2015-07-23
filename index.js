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
		}
	}
};

ParsletCombinator.prototype.parse = function(tokens) {
	this.tokens = tokens;
	this.tokens.index = this.tokens.index || 0;

	var index = this.tokens.index;

	for (var i = 0; i < this.parslets.length; i++) {
		try{
			return this.parslets[i].apply(this.parsletContext);
		} catch(e) {
			console.log(e)
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
			value = this.consume(':decimalLiteral');
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
		arguments.push(this.consume(':decimalLiteral'));

		this.consumeIf(',');
	}

	return arguments;
};

var additiveExpressionParslet = module.exports.additiveExpressionParslet = function() {
    var expr = this.consume(multiplicativeExpressionParslet);

    while(!this.eof() && ['+', '-'].indexOf(this.peek().lexeme) !== -1) {
        expr = {
            left: expr,
            operator: this.consume(':operator'),
            right: this.consume(multiplicativeExpressionParslet)
        }
    }

    return expr;
};

var multiplicativeExpressionParslet = module.exports.multiplicativeExpressionParslet = function() {
    var expr = this.consume(unaryExpressionParslet);

    while(!this.eof() &&['*', '/'].indexOf(this.peek().lexeme) !== -1) {
        expr = {
            left: expr,
            operator: this.consume(':operator'),
            right: this.consume(unaryExpressionParslet)
        }
    }

    return expr;
};

var unaryExpressionParslet = module.exports.unaryExpressionParslet = function() {
    var op = this.consumeIf(':operator');

    if (op) {
    	return {
    		op: op,
    		expr: this.consume(unaryExpressionParslet)
    	};
    } else {
    	return this.consume(postfixExpressionParslet);
    }
};

var postfixExpressionParslet = module.exports.postfixExpressionParslet = function() {
	return this.consume(':decimalLiteral');
};