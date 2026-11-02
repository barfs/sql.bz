<script lang="ts">
	let {
		onExecute,
		disabled = false
	}: {
		onExecute: () => void;
		disabled?: boolean;
	} = $props();
</script>

<div class="toolbar">
	<button class="toolbar-button" onclick={onExecute} {disabled}> ▶ Execute </button>
	<span class="separator"></span>
	<button class="toolbar-button" disabled>💾 Save</button>
	<button class="toolbar-button" disabled>📁 Open</button>
	<span class="separator"></span>
	<span class="hint">Press F5 or Ctrl+Enter to execute query</span>
</div>

<style>
	.toolbar {
		display: flex;
		align-items: center;
		background: #c0c0c0;
		padding: 2px;
		border-bottom: 1px solid #868686;
	}

	.toolbar-button {
		padding: 4px 8px;
		margin: 2px;
		font-size: 11px;
	}

	.separator {
		width: 1px;
		height: 20px;
		background: #868686;
		margin: 0 4px;
	}

	.hint {
		margin-left: 10px;
		font-size: 11px;
	}
</style>
