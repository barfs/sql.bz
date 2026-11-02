/**
 * CSV parser and table loader.
 *
 * Parses RFC-4180-ish CSV (handles quoted fields, embedded commas, newlines
 * inside quotes, escaped quotes as ""). Converts numeric-looking values to
 * numbers automatically so WHERE comparisons work naturally.
 */

import type { Row } from './types.js';

// --- CSV Parser -------------------------------------------------

/**
 * Parse a CSV string into an array of Rows.
 * First line is treated as the header row (column names).
 */
export function parseCSV(csv: string): Row[] {
	// Strip the byte order mark Excel adds, otherwise the first header is not 'id'
	const lines = splitCSVLines(csv.replace(/^\uFEFF/, '').trim());
	if (lines.length < 2) return [];

	const headers = parseCSVRow(lines[0]);
	const rows: Row[] = [];

	for (let i = 1; i < lines.length; i++) {
		const line = lines[i].trim();
		if (line === '') continue; // skip blank lines

		const values = parseCSVRow(line);
		const row: Row = {};

		for (let j = 0; j < headers.length; j++) {
			const raw = values[j] ?? '';
			row[headers[j]] = coerceValue(raw);
		}

		rows.push(row);
	}

	return rows;
}

/**
 * Split CSV text into logical lines, respecting quoted fields that
 * may contain newlines.
 */
function splitCSVLines(text: string): string[] {
	const lines: string[] = [];
	let current = '';
	let inQuotes = false;

	for (let i = 0; i < text.length; i++) {
		const ch = text[i];

		if (ch === '"') {
			if (inQuotes && text[i + 1] === '"') {
				current += '""';
				i++; // skip escaped quote
			} else {
				inQuotes = !inQuotes;
				current += ch;
			}
		} else if ((ch === '\n' || ch === '\r') && !inQuotes) {
			if (ch === '\r' && text[i + 1] === '\n') i++; // skip \r\n
			lines.push(current);
			current = '';
		} else {
			current += ch;
		}
	}

	if (current.length > 0) lines.push(current);
	return lines;
}

/**
 * Parse a single CSV line into field values.
 */
function parseCSVRow(line: string): string[] {
	const fields: string[] = [];
	let current = '';
	let inQuotes = false;
	let i = 0;

	while (i < line.length) {
		const ch = line[i];

		if (inQuotes) {
			if (ch === '"') {
				if (line[i + 1] === '"') {
					current += '"';
					i += 2;
					continue;
				}
				inQuotes = false;
				i++;
				continue;
			}
			current += ch;
			i++;
		} else {
			if (ch === '"') {
				inQuotes = true;
				i++;
			} else if (ch === ',') {
				fields.push(current);
				current = '';
				i++;
			} else {
				current += ch;
				i++;
			}
		}
	}

	fields.push(current);
	return fields;
}

/**
 * Coerce a raw CSV string value to the appropriate JS type.
 * - Empty string → '' (treated as null-like by the SQL engine)
 * - Integer-looking → number
 * - Float-looking → number
 * - 'true'/'false' → boolean
 * - Everything else → string
 */
function coerceValue(raw: string): string | number | boolean | null {
	if (raw === '') return '';

	// boolean
	const lower = raw.toLowerCase();
	if (lower === 'true') return true;
	if (lower === 'false') return false;

	// number (integers and decimals, but not things that start with 0 like zip codes)
	if (/^-?(0|[1-9]\d*)$/.test(raw)) {
		const n = parseInt(raw, 10);
		if (Number.isSafeInteger(n)) return n;
	}
	if (/^-?(0|[1-9]\d*)\.\d+$/.test(raw)) {
		return parseFloat(raw);
	}

	return raw;
}

// --- Table Loader -----------------------------------------------

/**
 * Import all .csv files from src/lib/tables/ at build time using Vite's
 * import.meta.glob. Returns a Record mapping table name (filename without
 * extension) to parsed rows.
 */
export function loadAllCSVTables(): Record<string, Row[]> {
	// Vite glob import
	// `eager: true` and `query: '?raw'` inlines the file
	// content as strings at build time. The glob path is relative to this file.
	const modules = import.meta.glob('../tables/*.csv', {
		eager: true,
		query: '?raw',
		import: 'default'
	}) as Record<string, string>;

	const tables: Record<string, Row[]> = {};

	for (const [path, csvContent] of Object.entries(modules)) {
		// Extract table name from path: '../tables/bookmarks.csv' → 'bookmarks'
		const match = path.match(/\/([^/]+)\.csv$/);
		if (!match) continue;
		const tableName = match[1];
		tables[tableName] = parseCSV(csvContent);
	}

	return tables;
}
