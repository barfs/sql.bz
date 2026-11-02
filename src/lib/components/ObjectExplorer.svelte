<script lang="ts">
	import type { TableMeta } from '$lib/data/types.js';

	let {
		tables,
		selectedTable,
		onSelect
	}: {
		tables: TableMeta[];
		selectedTable: string;
		onSelect: (name: string) => void;
	} = $props();
</script>

<div class="window object-explorer">
	<div class="title-bar">
		<div class="title-bar-text">Object Explorer</div>
	</div>
	<div class="window-body explorer-body">
		<ul class="tree-view">
			<li>
				<details open>
					<summary>📁 sql.bz (Read-Only)</summary>
					<ul>
						<li>
							<details open>
								<summary>📁 Tables</summary>
								<ul>
									{#each tables as table (table.name)}
										<li>
											<button
												class="tree-item"
												class:selected={selectedTable === table.name}
												onclick={() => onSelect(table.name)}
											>
												📋 {table.name}
												<span class="row-count">({table.rowCount})</span>
											</button>
										</li>
									{/each}
								</ul>
							</details>
						</li>
					</ul>
				</details>
			</li>
		</ul>
	</div>
</div>

<style>
	.object-explorer {
		width: 200px;
		margin: 4px;
	}

	.explorer-body {
		padding: 0;
		height: calc(100% - 18px);
		overflow-y: auto;
	}

	.tree-item {
		width: 100%;
		text-align: left;
		padding: 2px 4px;
		border: none;
		background: transparent;
		color: black;
		cursor: pointer;
		font-size: 12px;
	}

	.tree-item:hover,
	.tree-item.selected {
		background: #000080;
		color: white;
	}

	.row-count {
		font-size: 10px;
		opacity: 0.7;
	}
</style>
