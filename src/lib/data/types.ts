/** A row is a plain key-value record */
export type Row = Record<string, string | number | boolean | null>;

/** Metadata about a loaded table */
export interface TableMeta {
	name: string;
	columns: string[];
	rowCount: number;
}

/** The result of executing a query */
export interface QueryResult {
	columns: string[];
	rows: Row[];
	rowCount: number;
	elapsed: number; // ms
	error?: string;
}
