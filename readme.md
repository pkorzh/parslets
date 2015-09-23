#parslets

##Parslets

`partlets.lValue`

Consumes identifier or literal.

`partlets.rValue`

Consumes identifier.

`partlets.formalArgs`

Consumes formal arguments list.

`parslets.actualArgs`

Consumes actual arguments list.

`parslets.arith`

Options:

- postfixOps
- unaryOps

`parslets.sequence`

Returns a function that can be consumed. Usefull to parse list items to a list

`parslets.search`

Scans input stream for sucessfull consume. Ignorign the rest. Usefull when you need to extract only specific nodes


Consumes arith expression.

#Token wrapper

`consume(form)`

Consumes a token from input stream if it is satisfied by *form* criteria

If string, passed as a parameter, starts with `:`, method will consume a token with specified tag, otherwise &mdash; with specified lexeme.

It is possible to pass a list of functions. They will be executed in a row, if neither will return a successfull consume an error wil be thrown.

`consumeIf(form)`

same as `consume(form)`, but will not throw an error

`is(form)`

checks if current token match the criteria




##Example

###Parsing arith expressions

	var util     = require('util');
	var parslets = require('parslets');
	var toker    = require('toker');
	var lex      = new toker.LexicalAnalyzer('2 + 2 * -2');


	var tokens = lex.getTokens();
	var tw     = new parslets.TokenWrapper(tokens);
	var parsed = tw.consume(parslets.arith());

	console.log(util.inspect(parsed, {showHidden: false, depth: null}));
	
Will output:

    { type: 'binary',
      left: 
       { source: undefined,
         loc: { start: { line: 1, column: 0 }, end: { line: 1, column: 1 } },
         lexeme: 2,
         tag: 'decimalLiteral' },
      op: 
       { source: undefined,
         loc: { start: { line: 1, column: 2 }, end: { line: 1, column: 3 } },
         lexeme: '+',
         tag: 'operator' },
      right: 
       { type: 'binary',
         left: 
          { source: undefined,
            loc: { start: { line: 1, column: 4 }, end: { line: 1, column: 5 } },
            lexeme: 2,
            tag: 'decimalLiteral' },
         op: 
          { source: undefined,
            loc: { start: { line: 1, column: 6 }, end: { line: 1, column: 7 } },
            lexeme: '*',
            tag: 'operator' },
         right: 
          { type: 'unary',
            op: 
             { source: undefined,
               loc: { start: { line: 1, column: 8 }, end: { line: 1, column: 9 } },
               lexeme: '-',
               tag: 'operator' },
            expr: 
             { source: undefined,
               loc: { start: { line: 1, column: 9 }, end: { line: 1, column: 10 } },
               lexeme: 2,
               tag: 'decimalLiteral' } } } }
	
