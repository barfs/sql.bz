<script lang="ts">
	import '98.css';
	import {
		TitleBar,
		MenuBar,
		Toolbar,
		ObjectExplorer,
		QueryEditor,
		ResultsGrid,
		StatusBar,
		workspace,
		tableMetas
	} from '$lib';

	let statusText = $derived.by(() => {
		const { result } = workspace;
		if (!result) return 'Ready';
		if (result.error) return 'Error';
		return `${result.rowCount} row(s) - ${result.elapsed.toFixed(1)}ms`;
	});

	// F5 runs the query from anywhere, like SSMS
	function handleKeyDown(event: KeyboardEvent) {
		if (event.key !== 'F5') return;

		event.preventDefault();
		workspace.execute();
	}
</script>

<svelte:head>
	<title>sql.bz</title>
</svelte:head>

<svelte:window onkeydown={handleKeyDown} />

<div class="window app-window">
	<TitleBar title="SQL.bz" />

	<div class="window-body app-body">
		<MenuBar />
		<Toolbar onExecute={workspace.execute} disabled={workspace.querying} />

		<div class="main-content">
			<!-- Left Panel -->
			<ObjectExplorer
				tables={tableMetas}
				selectedTable={workspace.selectedTable}
				onSelect={workspace.selectTable}
			/>

			<!-- Right Panel -->
			<div class="right-panel">
				<QueryEditor bind:value={workspace.query} onExecute={workspace.execute} />
				<ResultsGrid result={workspace.result} isQuerying={workspace.querying} />
			</div>
		</div>

		<StatusBar status={statusText} />
	</div>
</div>

<style>
	:global(body) {
		margin: 0;
		padding: 0;
		overflow: hidden;
	}

	.app-window {
		width: 100%;
		height: 100vh;
		margin: 0;
	}

	.app-body {
		margin: 0;
		height: calc(100vh - 28px);
		display: flex;
		flex-direction: column;
	}

	.main-content {
		display: flex;
		flex: 1;
		overflow: hidden;
	}

	.right-panel {
		flex: 1;
		display: flex;
		flex-direction: column;
		margin: 4px;
	}
</style>
