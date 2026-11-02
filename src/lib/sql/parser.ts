/**
 * A lightweight SQL parser for in-memory row arrays.
 *
 * Supported syntax:
 *   SELECT [DISTINCT] col1 [AS alias], COUNT(*) [AS alias] FROM table
 *   WHERE col = 'value' AND col2 > 10 OR col3 LIKE '%pattern%'
 *   GROUP BY col [, col2]
 *   ORDER BY col [ASC|DESC] [, col2 [ASC|DESC]]
 *   LIMIT n
 *
 * Operators: =  !=  <>  <  >  <=  >=  [NOT] LIKE  [NOT] IN  IS [NOT] NULL
 * Wildcards in LIKE: % (any chars), _ (single char)
 * Aggregate: COUNT(*)  COUNT(col)
 */

import type { Row, QueryResult } from '../data/types.js';

// --- Token types ------------------------------------------------

type TokenType =
	| 'KEYWORD'
	| 'IDENT'
	| 'STRING'
	| 'NUMBER'
	| 'OP'
	| 'COMMA'
	| 'STAR'
	| 'LPAREN'
	| 'RPAREN'
	| 'EOF';

interface Token {
	type: TokenType;
	value: string;
}

const KEYWORDS = new Set([
	'SELECT',
	'DISTINCT',
	'FROM',
	'WHERE',
	'AND',
	'OR',
	'NOT',
	'ORDER',
	'BY',
	'ASC',
	'DESC',
	'GROUP',
	'LIMIT',
	'LIKE',
	'IN',
	'IS',
	'NULL',
	'COUNT',
	'INSERT',
	'UPDATE',
	'DELETE',
	'DROP',
	'CREATE',
	'ALTER',
	'TRUE',
	'FALSE',
	'AS'
]);

/** Keywords that can NEVER be used as identifiers (clause starters, logical ops) */
const RESERVED = new Set([
	'SELECT',
	'DISTINCT',
	'FROM',
	'WHERE',
	'AND',
	'OR',
	'NOT',
	'ORDER',
	'GROUP',
	'LIMIT',
	'INSERT',
	'UPDATE',
	'DELETE',
	'DROP',
	'CREATE',
	'ALTER'
]);

// --- Tokeniser --------------------------------------------------

function tokenize(sql: string): Token[] {
	const tokens: Token[] = [];
	let i = 0;

	while (i < sql.length) {
		// skip whitespace
		if (/\s/.test(sql[i])) {
			i++;
			continue;
		}

		// single-quoted string (supports '' escape for literal quote)
		if (sql[i] === "'") {
			let s = '';
			i++; // skip opening quote
			while (i < sql.length) {
				if (sql[i] === "'") {
					if (i + 1 < sql.length && sql[i + 1] === "'") {
						s += "'";
						i += 2; // escaped quote
						continue;
					}
					break; // end of string
				}
				s += sql[i];
				i++;
			}
			if (i >= sql.length) throw new Error('Unclosed quotation mark after the character string.');
			i++; // skip closing quote
			tokens.push({ type: 'STRING', value: s });
			continue;
		}

		// numbers
		if (
			/[0-9]/.test(sql[i]) ||
			(sql[i] === '-' && i + 1 < sql.length && /[0-9]/.test(sql[i + 1]))
		) {
			let num = sql[i];
			i++;
			while (i < sql.length && /[0-9.]/.test(sql[i])) {
				num += sql[i];
				i++;
			}
			tokens.push({ type: 'NUMBER', value: num });
			continue;
		}

		// operators
		if (sql[i] === '!' && sql[i + 1] === '=') {
			tokens.push({ type: 'OP', value: '!=' });
			i += 2;
			continue;
		}
		if (sql[i] === '<' && sql[i + 1] === '>') {
			tokens.push({ type: 'OP', value: '!=' });
			i += 2;
			continue;
		}
		if (sql[i] === '<' && sql[i + 1] === '=') {
			tokens.push({ type: 'OP', value: '<=' });
			i += 2;
			continue;
		}
		if (sql[i] === '>' && sql[i + 1] === '=') {
			tokens.push({ type: 'OP', value: '>=' });
			i += 2;
			continue;
		}
		if (sql[i] === '<') {
			tokens.push({ type: 'OP', value: '<' });
			i++;
			continue;
		}
		if (sql[i] === '>') {
			tokens.push({ type: 'OP', value: '>' });
			i++;
			continue;
		}
		if (sql[i] === '=') {
			tokens.push({ type: 'OP', value: '=' });
			i++;
			continue;
		}

		if (sql[i] === ',') {
			tokens.push({ type: 'COMMA', value: ',' });
			i++;
			continue;
		}
		if (sql[i] === '*') {
			tokens.push({ type: 'STAR', value: '*' });
			i++;
			continue;
		}
		if (sql[i] === '(') {
			tokens.push({ type: 'LPAREN', value: '(' });
			i++;
			continue;
		}
		if (sql[i] === ')') {
			tokens.push({ type: 'RPAREN', value: ')' });
			i++;
			continue;
		}

		// semicolons: treat as statement terminator, stop tokenising
		if (sql[i] === ';') {
			break;
		}

		// identifiers / keywords
		if (/[a-zA-Z_]/.test(sql[i])) {
			let word = '';
			while (i < sql.length && /[a-zA-Z0-9_]/.test(sql[i])) {
				word += sql[i];
				i++;
			}
			const upper = word.toUpperCase();
			if (KEYWORDS.has(upper)) {
				tokens.push({ type: 'KEYWORD', value: upper });
			} else {
				tokens.push({ type: 'IDENT', value: word });
			}
			continue;
		}

		throw new Error(`Incorrect syntax near '${sql[i]}'.`);
	}

	tokens.push({ type: 'EOF', value: '' });
	return tokens;
}

// --- AST types --------------------------------------------------

interface SelectColumn {
	expr: 'column' | 'star' | 'count_star' | 'count_col';
	name?: string; // column name (for column / count_col)
	alias?: string; // display alias
}

type Literal = string | number | boolean | null;

interface WhereCondition {
	column: string;
	op: string; // =  !=  <  >  <=  >=  LIKE  IN  IS_NULL  IS_NOT_NULL
	value?: Literal;
	values?: Literal[]; // for IN
}

interface WhereClause {
	type: 'condition' | 'and' | 'or';
	left?: WhereClause;
	right?: WhereClause;
	condition?: WhereCondition;
}

interface OrderByItem {
	column: string;
	direction: 'ASC' | 'DESC';
}

interface ParsedQuery {
	type: 'select';
	distinct: boolean;
	columns: SelectColumn[];
	table: string;
	where?: WhereClause;
	orderBy: OrderByItem[];
	groupBy: string[];
	limit?: number;
}

// --- Parser -----------------------------------------------------

class Parser {
	private tokens: Token[];
	private pos = 0;

	constructor(tokens: Token[]) {
		this.tokens = tokens;
	}

	private peek(): Token {
		return this.tokens[this.pos];
	}
	private advance(): Token {
		return this.tokens[this.pos++];
	}

	private expect(type: TokenType, value?: string): Token {
		const tok = this.advance();
		if (tok.type !== type || (value !== undefined && tok.value !== value)) {
			throw new Error(`Expected ${value ?? type} but got '${tok.value || 'end of query'}'`);
		}
		return tok;
	}

	private isKeyword(value: string): boolean {
		const t = this.peek();
		return t.type === 'KEYWORD' && t.value === value;
	}

	/** Check if the current token can be used as an identifier (column/table name).
	 *  Non-reserved keywords like BY, ASC, DESC, COUNT, NULL etc. can appear as identifiers. */
	private isIdentLike(): boolean {
		const t = this.peek();
		return t.type === 'IDENT' || (t.type === 'KEYWORD' && !RESERVED.has(t.value));
	}

	/** Consume the current token as an identifier name, allowing non-reserved keywords. */
	private expectIdent(): Token {
		const tok = this.peek();
		if (tok.type === 'IDENT' || (tok.type === 'KEYWORD' && !RESERVED.has(tok.value))) {
			return this.advance();
		}
		throw new Error(`Expected identifier but got '${tok.value}'`);
	}

	parse(): ParsedQuery {
		const firstTok = this.peek();
		if (
			firstTok.type === 'KEYWORD' &&
			['INSERT', 'UPDATE', 'DELETE', 'DROP', 'CREATE', 'ALTER'].includes(firstTok.value)
		) {
			throw new Error('Permission denied: This is a read-only database.');
		}

		this.expect('KEYWORD', 'SELECT');

		let distinct = false;
		if (this.isKeyword('DISTINCT')) {
			this.advance();
			distinct = true;
		}

		const columns = this.parseSelectList();

		this.expect('KEYWORD', 'FROM');
		const table = this.expectIdent().value;

		let where: WhereClause | undefined;
		if (this.isKeyword('WHERE')) {
			this.advance();
			where = this.parseWhereExpr();
		}

		const groupBy: string[] = [];
		if (this.isKeyword('GROUP')) {
			this.advance();
			this.expect('KEYWORD', 'BY');
			groupBy.push(...this.parseIdentList());
		}

		const orderBy: OrderByItem[] = [];
		if (this.isKeyword('ORDER')) {
			this.advance();
			this.expect('KEYWORD', 'BY');
			orderBy.push(...this.parseOrderByList());
		}

		let limit: number | undefined;
		if (this.isKeyword('LIMIT')) {
			this.advance();
			limit = Number(this.expect('NUMBER').value);
			if (!Number.isInteger(limit) || limit < 0)
				throw new Error('LIMIT must be a non-negative integer.');
		}

		// Anything left over is unsupported, e.g. JOIN or HAVING
		const rest = this.peek();
		if (rest.type !== 'EOF') throw new Error(`Incorrect syntax near '${rest.value}'.`);

		return { type: 'select', distinct, columns, table, where, orderBy, groupBy, limit };
	}

	private parseSelectList(): SelectColumn[] {
		const cols: SelectColumn[] = [];

		if (this.peek().type === 'STAR') {
			this.advance();
			cols.push({ expr: 'star' });
		} else {
			cols.push(this.parseSelectColumn());
			while (this.peek().type === 'COMMA') {
				this.advance();
				cols.push(this.parseSelectColumn());
			}
		}

		return cols;
	}

	private parseSelectColumn(): SelectColumn {
		// COUNT(*)  or  COUNT(col)
		// but only if followed by '('
		// This distinguishes `SELECT COUNT(*) ...` from `SELECT count ...` (column named count)
		if (this.isKeyword('COUNT') && this.tokens[this.pos + 1]?.type === 'LPAREN') {
			this.advance();
			this.expect('LPAREN');
			if (this.peek().type === 'STAR') {
				this.advance();
				this.expect('RPAREN');
				return { expr: 'count_star', alias: this.parseAlias() ?? 'count' };
			}
			const col = this.expectIdent();
			this.expect('RPAREN');
			return {
				expr: 'count_col',
				name: col.value,
				alias: this.parseAlias() ?? `count_${col.value}`
			};
		}

		if (this.peek().type === 'STAR') {
			this.advance();
			return { expr: 'star' };
		}

		// Column name: accept non-reserved keywords as identifiers
		const tok = this.expectIdent();
		return { expr: 'column', name: tok.value, alias: this.parseAlias() };
	}

	/** Optional `AS alias` after a select column */
	private parseAlias(): string | undefined {
		if (!this.isKeyword('AS')) return undefined;

		this.advance();
		return this.expectIdent().value;
	}

	private parseIdentList(): string[] {
		const ids: string[] = [];
		ids.push(this.expectIdent().value);
		while (this.peek().type === 'COMMA') {
			this.advance();
			ids.push(this.expectIdent().value);
		}
		return ids;
	}

	private parseOrderByList(): OrderByItem[] {
		const items: OrderByItem[] = [];
		const col = this.expectIdent().value;
		let dir: 'ASC' | 'DESC' = 'ASC';
		if (this.isKeyword('ASC') || this.isKeyword('DESC')) {
			dir = this.advance().value as 'ASC' | 'DESC';
		}
		items.push({ column: col, direction: dir });

		while (this.peek().type === 'COMMA') {
			this.advance();
			const c = this.expectIdent().value;
			let d: 'ASC' | 'DESC' = 'ASC';
			if (this.isKeyword('ASC') || this.isKeyword('DESC')) {
				d = this.advance().value as 'ASC' | 'DESC';
			}
			items.push({ column: c, direction: d });
		}

		return items;
	}

	// -- WHERE expression parsing (AND/OR with conditions) --

	private parseWhereExpr(): WhereClause {
		return this.parseOr();
	}

	private parseOr(): WhereClause {
		let left = this.parseAnd();
		while (this.isKeyword('OR')) {
			this.advance();
			const right = this.parseAnd();
			left = { type: 'or', left, right };
		}
		return left;
	}

	private parseAnd(): WhereClause {
		let left = this.parseWherePrimary();
		while (this.isKeyword('AND')) {
			this.advance();
			const right = this.parseWherePrimary();
			left = { type: 'and', left, right };
		}
		return left;
	}

	private parseWherePrimary(): WhereClause {
		// parenthesised expression
		if (this.peek().type === 'LPAREN') {
			this.advance();
			const expr = this.parseOr();
			this.expect('RPAREN');
			return expr;
		}

		// Column name: accept non-reserved keywords as identifiers
		const colTok = this.expectIdent();
		const column = colTok.value;

		// IS [NOT] NULL
		if (this.isKeyword('IS')) {
			this.advance();
			if (this.isKeyword('NOT')) {
				this.advance();
				this.expect('KEYWORD', 'NULL');
				return { type: 'condition', condition: { column, op: 'IS_NOT_NULL' } };
			}
			this.expect('KEYWORD', 'NULL');
			return { type: 'condition', condition: { column, op: 'IS_NULL' } };
		}

		// LIKE
		if (this.isKeyword('LIKE')) {
			this.advance();
			const val = this.expect('STRING');
			return { type: 'condition', condition: { column, op: 'LIKE', value: val.value } };
		}

		// NOT LIKE
		if (this.isKeyword('NOT')) {
			this.advance();
			if (this.isKeyword('LIKE')) {
				this.advance();
				const val = this.expect('STRING');
				return { type: 'condition', condition: { column, op: 'NOT_LIKE', value: val.value } };
			}
			if (this.isKeyword('IN')) {
				this.advance();
				this.expect('LPAREN');
				const vals = this.parseValueList();
				this.expect('RPAREN');
				return { type: 'condition', condition: { column, op: 'NOT_IN', values: vals } };
			}
			throw new Error(`Unexpected NOT usage near '${this.peek().value}'`);
		}

		// IN (val, val, ...)
		if (this.isKeyword('IN')) {
			this.advance();
			this.expect('LPAREN');
			const vals = this.parseValueList();
			this.expect('RPAREN');
			return { type: 'condition', condition: { column, op: 'IN', values: vals } };
		}

		// standard comparison: =  !=  <  >  <=  >=
		const opTok = this.advance();
		if (opTok.type !== 'OP') {
			throw new Error(`Expected operator but got '${opTok.value}'`);
		}
		return {
			type: 'condition',
			condition: { column, op: opTok.value, value: this.parseLiteral() }
		};
	}

	private parseValueList(): Literal[] {
		const vals = [this.parseLiteral()];
		while (this.peek().type === 'COMMA') {
			this.advance();
			vals.push(this.parseLiteral());
		}
		return vals;
	}

	/** A constant on the right side of a condition, e.g. 'rock', 42, NULL, TRUE */
	private parseLiteral(): Literal {
		const tok = this.advance();
		if (tok.type === 'STRING') return tok.value;
		if (tok.type === 'NUMBER') return parseFloat(tok.value);
		if (tok.type === 'KEYWORD' && tok.value === 'NULL') return null;
		if (tok.type === 'KEYWORD' && tok.value === 'TRUE') return true;
		if (tok.type === 'KEYWORD' && tok.value === 'FALSE') return false;
		throw new Error(`Expected a value but got '${tok.value || 'end of query'}'`);
	}
}

// --- Execution engine -------------------------------------------

function likeToRegex(pattern: string): RegExp {
	let re = '^';
	for (const ch of pattern) {
		if (ch === '%') re += '.*';
		else if (ch === '_') re += '.';
		else re += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	}
	re += '$';
	return new RegExp(re, 'i');
}

/** CSV blanks act as NULL */
function isEmpty(value: unknown): boolean {
	return value === null || value === undefined || value === '';
}

function equalsIgnoreCase(a: unknown, b: unknown): boolean {
	return String(a).toLowerCase() === String(b).toLowerCase();
}

/** Ordered comparison. Comparing against NULL is never true, as in SQL. */
function compareNonNull(a: unknown, b: unknown, test: (cmp: number) => boolean): boolean {
	if (isEmpty(a) || isEmpty(b)) return false;
	return test(compareValues(a, b));
}

function evaluateCondition(row: Row, cond: WhereCondition): boolean {
	const rowVal = row[cond.column];

	switch (cond.op) {
		case 'IS_NULL':
			return isEmpty(rowVal);
		case 'IS_NOT_NULL':
			return !isEmpty(rowVal);
		case 'LIKE':
			return likeToRegex(String(cond.value)).test(String(rowVal ?? ''));
		case 'NOT_LIKE':
			return !likeToRegex(String(cond.value)).test(String(rowVal ?? ''));
		case 'IN':
			return cond.values?.some((v) => equalsIgnoreCase(v, rowVal)) ?? false;
		case 'NOT_IN':
			return !(cond.values?.some((v) => equalsIgnoreCase(v, rowVal)) ?? false);
		case '=':
			return cond.value === null ? isEmpty(rowVal) : equalsIgnoreCase(rowVal, cond.value);
		case '!=':
			return cond.value === null ? !isEmpty(rowVal) : !equalsIgnoreCase(rowVal, cond.value);
		case '<':
			return compareNonNull(rowVal, cond.value, (c) => c < 0);
		case '>':
			return compareNonNull(rowVal, cond.value, (c) => c > 0);
		case '<=':
			return compareNonNull(rowVal, cond.value, (c) => c <= 0);
		case '>=':
			return compareNonNull(rowVal, cond.value, (c) => c >= 0);
		default:
			return false;
	}
}

function evaluateWhere(row: Row, clause: WhereClause): boolean {
	if (clause.type === 'condition') return evaluateCondition(row, clause.condition!);
	if (clause.type === 'and')
		return evaluateWhere(row, clause.left!) && evaluateWhere(row, clause.right!);
	if (clause.type === 'or')
		return evaluateWhere(row, clause.left!) || evaluateWhere(row, clause.right!);
	return true;
}

/** Numbers compare numerically, everything else as text. ISO dates sort correctly as text. */
function compareValues(a: unknown, b: unknown): number {
	if (a === b) return 0;
	if (isEmpty(a)) return -1;
	if (isEmpty(b)) return 1;
	if (typeof a === 'number' && typeof b === 'number') return a - b;
	// try numeric comparison
	const na = Number(a),
		nb = Number(b);
	if (!isNaN(na) && !isNaN(nb)) return na - nb;
	return String(a).localeCompare(String(b));
}

// --- Name resolution --------------------------------------------

function findIgnoreCase(names: string[], name: string): string | undefined {
	return names.find((n) => n.toLowerCase() === name.toLowerCase());
}

/** Map a column reference to its real name, e.g. 'TITLE' -> 'title' */
function resolveColumn(name: string, columns: string[]): string {
	const match = findIgnoreCase(columns, name);
	if (!match) throw new Error(`Invalid column name '${name}'.`);
	return match;
}

function resolveWhere(clause: WhereClause, columns: string[]): void {
	if (clause.condition) clause.condition.column = resolveColumn(clause.condition.column, columns);
	if (clause.left) resolveWhere(clause.left, columns);
	if (clause.right) resolveWhere(clause.right, columns);
}

/** Rewrite every source column reference to the table's real casing */
function resolveQuery(query: ParsedQuery, columns: string[]): void {
	for (const col of query.columns) {
		if (col.name) col.name = resolveColumn(col.name, columns);
	}
	query.groupBy = query.groupBy.map((name) => resolveColumn(name, columns));
	if (query.where) resolveWhere(query.where, columns);
}

/** Column header in the result set */
function outputName(col: SelectColumn): string {
	return col.alias ?? col.name ?? '*';
}

function isAggregate(col: SelectColumn): boolean {
	return col.expr === 'count_star' || col.expr === 'count_col';
}

/**
 * Map ORDER BY references to row keys. Aliases work, e.g. `SELECT title AS t ... ORDER BY t`.
 * Grouped rows only hold the selected outputs. Plain rows still hold every source column,
 * so `SELECT title ... ORDER BY rating` works.
 */
function orderKeys(query: ParsedQuery, columns: string[], grouped: boolean): OrderByItem[] {
	return query.orderBy.map(({ column, direction }) => {
		const target = column.toLowerCase();
		const selected = query.columns.find(
			(c) =>
				outputName(c).toLowerCase() === target ||
				(c.expr === 'column' && c.name!.toLowerCase() === target)
		);

		if (grouped) {
			if (!selected) {
				throw new Error(
					`Column '${column}' is invalid in the ORDER BY clause because it is not contained in either an aggregate function or the GROUP BY clause.`
				);
			}
			return { column: outputName(selected), direction };
		}

		if (selected?.expr === 'column') return { column: selected.name!, direction };
		return { column: resolveColumn(column, columns), direction };
	});
}

// --- Pipeline stages --------------------------------------------

/** Bucket rows by their GROUP BY values. No GROUP BY means one bucket, so COUNT(*) of no rows is 0. */
function groupRows(rows: Row[], groupBy: string[]): Row[][] {
	if (groupBy.length === 0) return [rows];

	const groups = new Map<string, Row[]>();
	for (const row of rows) {
		const key = JSON.stringify(groupBy.map((col) => row[col]));
		const group = groups.get(key);
		if (group) group.push(row);
		else groups.set(key, [row]);
	}
	return [...groups.values()];
}

/** Collapse each group into one output row in select list order */
function aggregate(rows: Row[], query: ParsedQuery): Row[] {
	for (const col of query.columns) {
		if (col.expr === 'star') throw new Error('SELECT * cannot be combined with GROUP BY or COUNT.');
		if (col.expr === 'column' && !query.groupBy.includes(col.name!)) {
			throw new Error(
				`Column '${col.name}' is invalid in the select list because it is not contained in either an aggregate function or the GROUP BY clause.`
			);
		}
	}

	return groupRows(rows, query.groupBy).map((group) => {
		const outRow: Row = {};
		for (const col of query.columns) {
			if (col.expr === 'count_star') outRow[outputName(col)] = group.length;
			else if (col.expr === 'count_col')
				outRow[outputName(col)] = group.filter((r) => !isEmpty(r[col.name!])).length;
			else outRow[outputName(col)] = group[0][col.name!];
		}
		return outRow;
	});
}

function sortRows(rows: Row[], keys: OrderByItem[]): void {
	if (keys.length === 0) return;

	rows.sort((a, b) => {
		for (const ob of keys) {
			const cmp = compareValues(a[ob.column], b[ob.column]);
			if (cmp !== 0) return ob.direction === 'DESC' ? -cmp : cmp;
		}
		return 0;
	});
}

function project(rows: Row[], columns: SelectColumn[]): Row[] {
	if (columns.some((c) => c.expr === 'star')) return rows;

	return rows.map((row) => {
		const projected: Row = {};
		for (const c of columns) projected[outputName(c)] = row[c.name!] ?? null;
		return projected;
	});
}

function distinctRows(rows: Row[]): Row[] {
	const seen = new Set<string>();
	return rows.filter((row) => {
		const key = JSON.stringify(row);
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

/**
 * Execute a SQL query against the provided tables.
 */
export function executeSQL(sql: string, tables: Record<string, Row[]>): QueryResult {
	const start = performance.now();

	try {
		const query = new Parser(tokenize(sql.trim())).parse();

		// resolve table, case-insensitive like SQL Server
		const tableNames = Object.keys(tables);
		const tableName = findIgnoreCase(tableNames, query.table);
		if (!tableName) {
			throw new Error(
				`Invalid object name '${query.table}'. Available tables: ${tableNames.join(', ')}`
			);
		}
		const tableData = tables[tableName];
		const tableColumns = tableData.length > 0 ? Object.keys(tableData[0]) : [];
		resolveQuery(query, tableColumns);

		// 1) filter (WHERE)
		let rows = query.where
			? tableData.filter((row) => evaluateWhere(row, query.where!))
			: [...tableData];

		// 2) GROUP BY / COUNT, then ORDER BY on the grouped rows.
		//    Plain queries sort before projection so unselected columns can still be sorted on.
		const grouped = query.groupBy.length > 0 || query.columns.some(isAggregate);
		if (grouped) {
			rows = aggregate(rows, query);
			sortRows(rows, orderKeys(query, tableColumns, true));
		} else {
			sortRows(rows, orderKeys(query, tableColumns, false));
			rows = project(rows, query.columns);
		}

		// 3) DISTINCT
		if (query.distinct) rows = distinctRows(rows);

		// 4) LIMIT
		if (query.limit !== undefined) rows = rows.slice(0, query.limit);

		const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
		const elapsed = performance.now() - start;

		return { columns, rows, rowCount: rows.length, elapsed };
	} catch (err: unknown) {
		const elapsed = performance.now() - start;
		const message = err instanceof Error ? err.message : 'Query execution failed.';
		return { columns: [], rows: [], rowCount: 0, elapsed, error: message };
	}
}
