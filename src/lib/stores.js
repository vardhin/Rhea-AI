import { writable } from 'svelte/store';

// Global dark mode store
export const darkMode = writable(false);

// Selected model store
export const selectedModel = writable('llama3.2:latest'); // Default model
export const serverIP = writable(''); // New store for server IP