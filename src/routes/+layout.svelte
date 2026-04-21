<script lang="ts">
	let { children } = $props();
</script>

<svelte:head>
	<title>Shopy</title>
	<meta name="description" content="Private shared shopping list" />
	<meta name="theme-color" content="#111111" />
</svelte:head>

{@render children()}

<style>
	:global(*) {
		box-sizing: border-box;
		margin: 0;
		padding: 0;
	}
	:global(body) {
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
		background: #f5f5f5;
		min-height: 100dvh;
		-webkit-tap-highlight-color: transparent;
	}
</style>
