<script lang="ts">
	import type { QueryResult } from '$lib/data/types.js';

	let {
		result = null,
		isQuerying = false
	}: {
		result: QueryResult | null;
		isQuerying?: boolean;
	} = $props();
</script>

<div class="window results-grid">
	<div class="title-bar">
		<div class="title-bar-text">Results</div>
	</div>
	<div class="window-body results-body">
		{#if isQuerying}
			<div class="results-message">
				<div class="progress-indicator"></div>
				Executing query...
			</div>
		{:else if result?.error}
			<div class="results-message error">
				❌ {result.error}
			</div>
		{:else if result && result.rows.length > 0}
			<table>
				<thead>
					<tr>
						{#each result.columns as column (column)}
							<th>{column}</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each result.rows as row, i (i)}
						<tr>
							{#each result.columns as column (column)}
								<td>{row[column] ?? ''}</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
			<div class="result-footer">
				{result.rowCount} row(s) returned in {result.elapsed.toFixed(1)}ms
			</div>
		{:else if result}
			<div class="results-message muted">
				Query returned no results. ({result.elapsed.toFixed(1)}ms)
			</div>
		{:else}
			<div class="results-message muted">
				No results to display. Execute a query to see results.
			</div>
		{/if}
	</div>
</div>

<style>
	.results-grid {
		flex: 1;
	}

	.results-body {
		padding: 0;
		height: calc(100% - 18px);
		overflow: auto;
	}

	.results-message {
		padding: 10px;
		font-size: 12px;
	}

	.results-message.error {
		color: red;
		font-family: monospace;
	}

	.results-message.muted {
		color: #666;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 12px;
	}

	th {
		background: #c0c0c0;
		border: 1px solid #868686;
		padding: 2px 4px;
		text-align: left;
		position: sticky;
		top: 0;
	}

	td {
		border: 1px solid #868686;
		padding: 2px 4px;
	}

	tr:hover td {
		background: #e8e8e8;
	}

	.result-footer {
		padding: 4px;
		background: #c0c0c0;
		font-size: 11px;
	}

	.progress-indicator {
		width: 150px;
		height: 20px;
		background: repeating-linear-gradient(90deg, #000080, #000080 10px, #c0c0c0 10px, #c0c0c0 20px);
		animation: progress 1s linear infinite;
		margin-bottom: 10px;
	}

	@keyframes progress {
		0% {
			background-position: 0 0;
		}
		100% {
			background-position: 20px 0;
		}
	}
</style>
