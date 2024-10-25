<script>
	import { onMount} from 'svelte';
	import ollama from 'ollama';
	import { selectedModel } from '$lib/stores';
	import NavBar from '../NavBar.svelte';
	import { darkMode } from '$lib/stores';
    import { goto } from '$app/navigation';

	let models = [];
	let loading = true;
	let error = null;
	let isDarkMode = false;

	darkMode.subscribe((value) => {
		isDarkMode = value;
	});

	onMount(async () => {
		try {
			const modelList = await ollama.list();
			models = modelList.models;
			loading = false;
		} catch (e) {
			error = "Failed to fetch models. Make sure Ollama is running.";
			loading = false;
		}
	});

	async function selectModel(model) {
		selectedModel.set(model.name);
		try {
			await goto('/');
		} catch (error) {
			console.error('Navigation error:', error);
		}
	}
</script>

<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com">
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
	<link href="https://fonts.googleapis.com/css2?family=Quicksand:wght@400;700&display=swap" rel="stylesheet">
</svelte:head>


<main class:dark-mode={isDarkMode}>
    <NavBar title="Settings" />
	<h1>Available Models</h1>
	{#if loading}
		<p>Loading models...</p>
	{:else if error}
		<p class="error">{error}</p>
	{:else}
		<ul>
			{#each models as model}
				<li on:click={() => selectModel(model)}>
					{model.name}
				</li>
			{/each}
		</ul>
	{/if}
</main>

<style>
	:global(*) {
		font-family: 'Quicksand', sans-serif;
	}

	
    :root {
    --bg-color: #ffffff;
    --text-color: #333333;
    --primary-color: #128C7E;
    --secondary-color: #075E54;
    --user-message-bg: #dcf8c6;
    --ai-message-bg: #f0f0f0;
    --input-bg: rgba(255, 255, 255, 0.8);
    --input-border: #cccccc;
    --scroll-thumb: rgba(0, 0, 0, 0.2);
  }

  .dark-mode {
    --bg-color: #1a1a1a;
    --text-color: #e0e0e0;
    --primary-color: #2ecc71;
    --secondary-color: #27ae60;
    --user-message-bg: #2c3e50;
    --ai-message-bg: #34495e;
    --input-bg: rgba(30, 30, 30, 0.8);
    --input-border: #555555;
    --scroll-thumb: rgba(255, 255, 255, 0.2);
  }


	main {
		padding: 20px;
		padding-top: 80px; /* Adjust based on your NavBar height */
		max-width: 600px;
		margin: 0 auto;
		background-color: var(--bg-color);
		color: var(--text-color);
		min-height: 100vh;
		transition: background-color 0.3s, color 0.3s;
	}

	h1 {
		font-size: 1.5em;
		margin-bottom: 20px;
		font-weight: 700;
	}

	ul {
		list-style-type: none;
		padding: 0;
	}

	li {
		padding: 10px;
		margin-bottom: 10px;
		background-color: var(--ai-message-bg);
		border-radius: 5px;
		cursor: pointer;
		transition: background-color 0.3s;
	}

	li:hover {
		background-color: var(--user-message-bg);
	}

	.error {
		color: #ff6b6b;
	}

	/* Optional: Adjust specific elements for better readability */
	:global(button) {
		font-family: 'Arial', sans-serif;
	}
</style>
