import { executeSQL } from '../sql/parser.js';
import { loadAllCSVTables } from './csv.js';
import type { QueryResult, TableMeta } from './types.js';

const DEFAULT_TABLE = 'bookmarks';

// Simulated latency so the progress indicator is visible
const QUERY_DELAY_MS = 150;

// CSV tables are inlined at build time and never change
const tables = loadAllCSVTables();
const names = Object.keys(tables).sort();
const initialTable = names.includes(DEFAULT_TABLE) ? DEFAULT_TABLE : (names[0] ?? '');

export const tableMetas: TableMeta[] = names.map((name) => ({
	name,
	columns: tables[name].length > 0 ? Object.keys(tables[name][0]) : [],
	rowCount: tables[name].length
}));

function selectAllFrom(name: string): string {
	return `SELECT * FROM ${name}`;
}

/** Editor state shared by the UI. Methods are arrow functions so they can be passed as callbacks. */
class Workspace {
	selectedTable = $state(initialTable);
	query = $state(selectAllFrom(initialTable));

	// Run the default query up front so visitors and the prerendered HTML show data
	result = $state<QueryResult | null>(initialTable ? executeSQL(this.query, tables) : null);
	querying = $state(false);

	selectTable = (name: string) => {
		this.selectedTable = name;
		this.query = selectAllFrom(name);
		this.execute();
	};

	execute = () => {
		if (this.querying) return;

		this.querying = true;
		setTimeout(() => {
			this.result = executeSQL(this.query, tables);
			this.querying = false;
		}, QUERY_DELAY_MS);
	};
}

export const workspace = new Workspace();
