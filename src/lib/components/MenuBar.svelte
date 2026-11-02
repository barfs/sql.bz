<script lang="ts">
	const menuItems = ['File', 'Edit', 'View', 'Query', 'Tools', 'Window', 'Help'];
</script>

<div class="menu-bar">
	{#each menuItems as item (item)}
		<button class="menu-bar-item">{item}</button>
	{/each}
</div>

<style>
	.menu-bar {
		display: flex;
		background: #c0c0c0;
		border-bottom: 1px solid white;
		border-top: 1px solid white;
	}

	.menu-bar-item {
		padding: 4px 8px;
		border: none;
		background: transparent;
		font-size: 11px;
		cursor: pointer;
	}

	.menu-bar-item:hover {
		background: #000080;
		color: white;
	}
</style>
