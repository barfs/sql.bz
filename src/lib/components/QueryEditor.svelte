<script lang="ts">
	let {
		value = $bindable(''),
		onExecute
	}: {
		value: string;
		onExecute: () => void;
	} = $props();

	// F5 is handled by the page. Handling it here too would run the query twice.
	function handleKeyDown(event: KeyboardEvent) {
		if (!event.ctrlKey || event.key !== 'Enter') return;

		event.preventDefault();
		onExecute();
	}
</script>

<div class="window query-editor">
	<div class="title-bar">
		<div class="title-bar-text">Query Editor</div>
	</div>
	<div class="window-body editor-body">
		<textarea bind:value onkeydown={handleKeyDown} placeholder="Enter your SQL query here..."
		></textarea>
	</div>
</div>

<style>
	.query-editor {
		height: 200px;
		margin-bottom: 4px;
	}

	.editor-body {
		padding: 0;
		height: calc(100% - 18px);
	}

	textarea {
		width: 100%;
		height: 100%;
		font-family: 'Courier New', monospace;
		font-size: 12px;
		resize: none;
		border: none;
		padding: 4px;
		box-sizing: border-box;
	}
</style>
