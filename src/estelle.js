(function() {
    'use strict';

    if (window.Estelle) return;

    var Estelle = function (source) {
        var i = 0;
        var isInsideTag = false;
        var buffer = '';
        var stack = [];
        var currentLexeme = null;
        var previousLexeme = null;
        var lastClose = null;

        var col = 0, line = 1;

        while (i < source.length) {
            col++;
            if (source[i] == '\n') {
                line++;
                col = 0;
            }

            var chunk2 = source.substr(i, 2);
            if (chunk2 == this.options.opening || chunk2 == this.options.closing || i == source.length - 1) {
                var lexemeOpened = chunk2 == this.options.opening;
                var lexemeClosed = chunk2 == this.options.closing;
                var isEnd = i == source.length - 1;
                var tag;
                if (lexemeClosed) {
                    var parts = buffer.trim().split(' ');
                    currentLexeme.name = parts[0];
                    currentLexeme.args = parts.slice(1);
                    stack.push(currentLexeme);
                    previousLexeme = currentLexeme;
                    lastClose = [col, line];
                } else {
                    if (lexemeOpened) {
                        currentLexeme = {name: null, col: col, line: line};
                    }
                    if (buffer.length && (lexemeOpened || isEnd)) {
                        //if (previousTag) {
                            //previousTag.tail = buffer.trim(' '); // TODO: Remove trim(' ')
                        //} else {
                            //tag = {name: null, tail: buffer, col: 1, line: 1, id: Math.random()};
                            //previousTag = tag;
                            //stack.push(tag);
                        //}
                        var lexeme = {name: 'text', col: 1, line: 1, content: buffer};
                        if (lastClose) {
                            lexeme.col = lastClose[0];
                            lexeme.line = lastClose[1];
                        }
                        stack.push(lexeme);
                    }
                }
                buffer = '';
                i++;
                col++;
            } else {
                buffer += source[i];
            }
            i++;
        }
        this.stack = stack;

        var scope = {name: 'root', children: []};

        for (i = 0; i < this.stack.length; i++) {
            var lexeme = this.stack[i];
            var match;

            if (match = lexeme.name.match(/^end(.*)/)) {
                if (match[1] != scope.name) {
                    this.error(lexeme, 'Tag mismatch: expected "%", got "%".', 'end' + scope.name, lexeme.name);
                }
                scope = scope.parent;
                tag = lexeme;
            } else {
                var Tag = this.tags[lexeme.name];
                if (!Tag) {
                    this.error(lexeme, 'Unknown tag - "%".', lexeme.name);
                }
                var tag = new Tag(lexeme);
                tag.parent = scope;
                scope.children.push(tag);
                if (tag.paired) {
                    scope = tag;
                }
            }

            //if (item.tail) {
                //scope.children.push({item.tail);
            //}
        }

        this.scope = scope;
    };

    Estelle.prototype.createTag = function (name, paired, render) {
        var Tag = function(data) {
            this.data = data;
            this.parent = null;
            this.children = [];
        };

        Tag.prototype.name = name;
        Tag.prototype.paired = paired;
        Tag.prototype.render = function(ctx) {
            var result = render.call(this, ctx);
            if (typeof result !== 'undefined') {
                return result;
            } else {
                return '';
            }
        };
        Tag.prototype.findNext = function (name) {
        };
        Tag.prototype.calculate = function (expr, scope) {
            try {
                var fn = new Function('with (this) { return ' + expr.trim() + '; }');
                return (fn).call(scope);
            } catch (e) {
                if(e instanceof ReferenceError) {
                    Estelle.prototype.error(this.data, e.message);
                } else {
                    throw e;
                }
            }
        };

        return Tag;
    };

    Estelle.prototype.tags = {
    };

    Estelle.prototype.render = function (context) {
        var i;
        var output = '';
        for (i = 0; i < this.scope.children.length; i++) {
            output += this.scope.children[i].render(context);
        }
        return output;
    };

    Estelle.prototype.error = function () {
        var lexeme = arguments[0];
        var error = arguments[1];
        var args = Array.prototype.slice.call(arguments, 2);
        var i;
        error = lexeme.line + ':' + lexeme.col + ': ' + error;
        for (i = 0; i < args.length; i++) {
            error = error.replace('%', args[i]);
        }
        throw new Error('Estelle error: ' + error);
    };

    Estelle.prototype.options = {
        opening: '<@',
        closing: '@>',
    };

    /**
     * Tag implementations.
     */

    Estelle.prototype.tags['if'] = Estelle.prototype.createTag('if', true, function (ctx) {
        var condition = this.data.args.join(' ');

        if (this.calculate(condition, ctx)) {
            var i = 0;
            var s = '';
            for (i = 0; i < this.children.length; i++) {
                s += this.children[i].render(ctx);
            }
            return s;
        }
    });

    Estelle.prototype.tags['for'] = Estelle.prototype.createTag('for', true, function (ctx) {
        if (this.data.args.length != 3 || this.data.args[1] != 'in') {
            Estelle.prototype.error(this.data, 'Bad argument count passed into "for" tag.');
        }

        var handle = this.data.args[0];
        var iterable = this.calculate(this.data.args[2], ctx);

        var i;
        var s = '';
        for (i = 0; i < iterable.length; i++) {
            ctx[handle] = iterable[i];
            var ii;
            for (ii = 0; ii < this.children.length; ii++) {
                s += this.children[ii].render(ctx);
            }
        }
        return s;
    });

    Estelle.prototype.tags['with'] = Estelle.prototype.createTag('with', true, function (ctx) {
        var i = 0;
        var s = '';
        for (i = 0; i < this.children.length; i++) {
            s += this.children[i].render(this.calculate(this.data.args[0], ctx));
        }
        return s;
    });


    Estelle.prototype.tags['date'] = Estelle.prototype.createTag('date', false, function (ctx) {
        return new Date();
    });
    Estelle.prototype.tags['random'] = Estelle.prototype.createTag('random', false, function (ctx) {
        return Math.random();
    });
    Estelle.prototype.tags['print'] = Estelle.prototype.createTag('text', false, function (ctx) {
        return this.calculate(this.data.args[0], ctx);
    });
    Estelle.prototype.tags['='] = Estelle.prototype.tags['print'];
    Estelle.prototype.tags['text'] = Estelle.prototype.createTag('text', false, function (ctx) {
        return this.data.content;
    });


    window.Estelle = Estelle;
})();
