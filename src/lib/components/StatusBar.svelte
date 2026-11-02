<script lang="ts">
	let {
		status = 'Ready',
		mode = 'Read-Only Mode',
		database = 'sql.bz'
	}: {
		status?: string;
		mode?: string;
		database?: string;
	} = $props();
</script>

<div class="status-bar">
	<p class="status-bar-field">{status}</p>
	<p class="status-bar-field">{mode}</p>
	<p class="status-bar-field">{database}</p>
</div>
