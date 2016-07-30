'use babel';

const LEADING_PATT = /^(\s*(-|\+|\*|<!--|\/\*|\(\*|[0-9]+\.|[a-z]+\.|[A-Z]+\.)\s+)(.*)$/;
const PREFIX_PATT = /^(\s*[`"'\[\](){}:;=+!@#$%^&*_~,.<>?/\\|-]*\s+)(.*)$/;

export default {

    activate(state) {
        // Register command that toggles this view
        atom.commands.add('atom-text-editor', {
            'magic-reflow:reflow': (event) => this.invoke(event)
        });
    },

    deactivate() {
    },

    serialize() {
        return null;
    },

    invoke(event) {
        let editor = event.currentTarget.getModel();
        let range = editor.getSelectedBufferRange();

        // XXX need to deal with leading sigils as appropriate; means we
        // probably need to do some scanning in this neighborhood rather than
        // relying on the editor's notion of a paragraph
        if (range.isEmpty()) range = editor.getCurrentParagraphBufferRange();
        if (! range) return;

        let text = this.reflow(
            editor.getTextInRange(range),
            atom.config.get('editor.preferredLineLength', {scope: editor.getRootScopeDescriptor()}),
            atom.config.get('editor.tabLength', {scope: editor.getRootScopeDescriptor()})
        );

        editor.getBuffer().setTextInRange(range, text);
    },

    reflow(text, lineLength = 80, tabLength = 8) {
        let [head, body, tail] = this.head_body_tail(text);
        let useTabs = body.indexOf('\t') != -1;

        let lines = body.split(/\r\n|\r|\n/);
        let out = this.reflow_lines(lines, lineLength, tabLength);

        return head.concat(Array.from(out).join('\n'), tail);
    },

    reflow_lines: function*(lines, lineLength, tabLength) {
        lines = Array.from(lines);

        // First, try to identify a prefix that's common to all the lines.
        // If we find one, strip it off and proceed as if it weren't there.
        let prefix = this.common_prefix(lines);
        if (prefix !== '') {
            yield* this.strip_and_reinvoke(
                prefix, lines, lineLength, tabLength);
            return;
        }

        // Now break into paragraphs and reflow each paragraph separately.
        let para = [];
        for (let l of lines) {
            // XXX look for list items
            if (l.search(/^\s*$/) !== -1) {
                yield* this.reflow_para(para, lineLength, tabLength);
                yield l;
                para = [];
            } else {
                para.push(l);
            }
        }
        yield* this.reflow_para(para, lineLength, tabLength);
    },

    strip_and_reinvoke(prefix, lines, lineLen, tabLen) {
        return this.add_prefix(prefix,
            this.reflow_lines(this.remove_prefix(prefix, lines),
                lineLen - prefix.length, tabLen));
    },

    reflow_para: function*(lines, lineLength, tabLength) {
        lines = Array.from(lines);

        // Again, strip away any common prefix specific to this paragraph (which
        // might reveal nested paragraphs)
        let prefix = this.common_prefix(lines);
        if (prefix !== '') {
            yield* this.strip_and_reinvoke(
                prefix, lines, lineLength, tabLength);
            return;
        }

        let firstLineLen = lineLength;

        let firstDecorator = '';
        let restDecorator = '';

        let m;
        if (m = lines[0].match(/^\s+/)) {
            // There is a leading indent; keep it accordingly.
            firstLineLen -= m[0].length;
            firstDecorator = m[0];

        } else if (m = lines[0].match(LEADING_PATT)) {
            // Found something that looks like it's supposed to be a leading
            // sigil (e.g. a list bullet or number).
            firstLineLen -= m[1].length;
            lineLength -= m[1].length;
            firstDecorator = m[1];
            restDecorator = ' '.repeat(m[1].length);
            lines[0] = m[3];

        } else if (m = lines[0].match(PREFIX_PATT)) {
            // Since this wasn't removed by prefix stripping, it must be a
            // leading sigil.  Keep it accordingly.
            firstLineLen -= m[1].length;
            lineLength -= m[1].length;
            firstDecorator = m[1];
            restDecorator = ' '.repeat(m[1].length);
            lines[0] = m[2];
        }

        let wrapped_lines = this.wrap_one_para(
            lines.join("\n"), lineLength, firstLineLen);

        let first = true;
        for (let line of wrapped_lines) {
            line = (first ? firstDecorator : restDecorator).concat(line);
            yield line
            first = false;
        }
    },

    wrap_one_para: function*(text, fill, firstFill) {
        text = text
            // SPECIAL CASE: Sentences that end at the end of a line should have
            // two spaces after them.
            .replace(/([.!?])\s*\n\s*/gm, '$1  ')
            .replace(/\n\s*/gm, ' ');

        let res = [];
        let start = 0;
        let end = start;
        let curFill = firstFill ? firstFill : fill;

        for (let [ws, word] of this.segments_of(text)) {
            let newend = end + ws.length + word.length;

            if (end == start) {
                // Current line is empty. Skip over leading whitespace that
                // would otherwise get put at the beginning of the line.
                start += ws.length;

            } else if (newend > start + curFill) {
                // Current line is full.  Emit what we have and start the next
                // line.
                let res = text.substr(start, end - start);
                yield res;
                curFill = fill; // no longer on the first line

                // Skip leading whitespace on the next line, and start the line
                // with the current word.
                start = end + ws.length;
            }

            end = newend;
        }

        if (start != end) {
            let res = text.substr(start, end - start);
            yield res;
        }
    },

    common_prefix(lines) {
        if (lines.length == 0) return '';

        if (lines.length == 1) {
            // We only have one line to work with, so need to guess if we have a
            // common prefix.

            // Things in LEADING_PATT are usually leading sigils, not prefixes.
            let m = lines[0].match(LEADING_PATT);
            if (m) return '';

            // Things in PREFIX_PATT (but not LEADING_PATT) are usually prefixes
            m = lines[0].match(PREFIX_PATT);
            return m ? m[1] : '';
        }

        let pf = '';
        let testpf = '';

        while (testpf.length < lines[0].length) {
            pf = testpf;
            testpf = lines[0].substr(0, testpf.length + 1);

            // Letters/numbers/etc. cannot be part of a prefix.
            if (testpf.search(/\w/) !== -1) return pf;

            // Check if any line doesn't match the test prefix.
            for (line of lines) {
                if (testpf.length > line.length) return pf;
                if (line.substr(0, testpf.length) !== testpf) return pf;
            }
        }

        return testpf;
    },

    add_prefix: function*(prefix, lines) {
        for (line of lines) {
            yield prefix.concat(line);
        }
    },

    remove_prefix: function*(prefix, lines) {
        for (line of lines) {
            if (line.substr(0, prefix.length) === prefix) {
                yield line.substr(prefix.length);
            } else {
                yield line;
            }
        }
    },

    head_body_tail: function(text) {
        let head = (text.match(/^\s*\n/) || [''])[0];
        let tail = (text.match(/\n\s*$/) || [''])[0];
        let body = text.substr(head.length,
                text.length - head.length - tail.length);
        return [head, body, tail];
    },

    segments_of: function*(text) {
        let span = /(\s*)(\S+)/gm;
        let m;
        while (m = span.exec(text)) {
            yield [m[1], m[2]];
        }
    },
};
