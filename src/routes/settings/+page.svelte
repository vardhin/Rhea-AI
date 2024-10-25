<script>
	import { onMount} from 'svelte';
	import ollama from 'ollama';
	import { selectedModel, darkMode, serverIP } from '$lib/stores';
	import NavBar from '../NavBar.svelte';
	import { goto } from '$app/navigation';

	let models = [];
	let loading = true;
	let error = null;
	let isDarkMode = false;
	let customIP = '';

	darkMode.subscribe((value) => {
		isDarkMode = value;
	});

	onMount(async () => {
		try {
			const modelList = await ollama.list();
			models = modelList.models;
			loading = false;

			// Fetch the default IP and update the customIP
			const defaultIP = await getDefaultIP();
			customIP = defaultIP;
			serverIP.set(defaultIP);
		} catch (e) {
			error = "Failed to fetch models. Make sure Ollama is running.";
			loading = false;
		}

		// Fetch the current serverIP value
		serverIP.subscribe(value => {
			customIP = value;
		});
	});

	async function selectModel(model) {
		selectedModel.set(model.name);
		try {
			await goto('/');
		} catch (error) {
			console.error('Navigation error:', error);
		}
	}

	async function getDefaultIP() {
		try {
			const response = await fetch('http://localhost:3000/api/local-ip');
			const data = await response.json();
			return data.ip;
		} catch (error) {
			console.error('Error fetching local IP:', error);
			return 'localhost';
		}
	}

	function updateServerIP() {
		serverIP.set(customIP);
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
	
	<!-- IP Address Input -->
	<div class="ip-input">
		<label for="server-ip">Server IP:</label>
		<input 
			type="text" 
			id="server-ip" 
			bind:value={customIP} 
			placeholder="Enter server IP"
		/>
		<button on:click={updateServerIP}>Update IP</button>
	</div>

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

	.ip-input {
		margin-bottom: 20px;
	}

	.ip-input label {
		display: block;
		margin-bottom: 5px;
	}

	.ip-input input {
		width: 100%;
		padding: 8px;
		margin-bottom: 10px;
		border: 1px solid #ccc;
		border-radius: 4px;
	}

	.ip-input button {
		padding: 8px 16px;
		background-color: var(--primary-color);
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
	}

	.ip-input button:hover {
		background-color: var(--secondary-color);
	}
</style>
