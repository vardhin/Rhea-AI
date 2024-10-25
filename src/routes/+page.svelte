<script>
  import { onMount } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { flip } from 'svelte/animate';
  import FaPaperPlane from 'svelte-icons/fa/FaPaperPlane.svelte';
  import FaChevronDown from 'svelte-icons/fa/FaChevronDown.svelte';
  import NavBar from './NavBar.svelte';
  import { darkMode, selectedModel } from '$lib/stores';
  import { spring } from 'svelte/motion'; // Add this import
  import { writable } from 'svelte/store'; // Import writable for messages

  const SERVER_URL = 'http://192.168.150.99:3000';

  let prompt = '';
  let messages = writable([]); // Make messages a writable store
  let loading = false;
  let serverReady = false;
  let ollamaReady = false; // Add this line
  let messageContainer;
  let isAtBottom = true;
  let showScrollButton = false;
  let currentStreamingMessage = '';
  let messageHistory = [];
  let isDarkMode;

  const pageLoaded = spring(0);

  let scrollTimeout;
  let lastScrollTime = 0;
  const SCROLL_INTERVAL = 600; // ms between scroll updates

  let textareaElement;

  const MAX_TEXTAREA_HEIGHT = '100px'; // Set a maximum height for the textarea

  let currentModel;

  selectedModel.subscribe(value => {
    currentModel = value;
  });

  let models = []; // Add this line to define the models variable

  let viewportHeight;
  let isKeyboardVisible = false;

  // Subscribe to the darkMode store
  darkMode.subscribe(value => {
    isDarkMode = value;
  });

  onMount(() => {
    updateViewportHeight();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  });

  function updateViewportHeight() {
    viewportHeight = window.innerHeight;
  }

  function handleResize() {
    const newViewportHeight = window.innerHeight;
    if (newViewportHeight < viewportHeight) {
      // Keyboard is likely visible
      isKeyboardVisible = true;
    } else {
      // Keyboard is likely hidden
      isKeyboardVisible = false;
    }
    viewportHeight = newViewportHeight;
  }

  function handleFocus() {
    // You can add additional logic here if needed
  }

  function handleBlur() {
    // You can add additional logic here if needed
  }

  onMount(async () => {
    await checkServerConnection();
    await fetchModels();
  });

  async function checkServerConnection() {
    try {
      const response = await fetch(`${SERVER_URL}/api/check-connection`);
      const data = await response.json();
      serverReady = data.status === 'connected';
      ollamaReady = serverReady; // Set ollamaReady based on server connection
      if (serverReady) {
        addMessage('system', 'Successfully connected to server.');
      } else {
        addMessage('system', 'Failed to connect to server.');
      }
    } catch (error) {
      console.error('Error checking server connection:', error);
      addMessage('system', 'Error connecting to server.');
      serverReady = false;
      ollamaReady = false;
    }
  }

  async function fetchModels() {
    try {
      const response = await fetch(`${SERVER_URL}/api/models`);
      models = await response.json();
    } catch (error) {
      console.error('Error fetching models:', error);
    }
  }

  async function generateResponse() {
    if (!serverReady || !prompt.trim()) return;

    const userMessage = prompt.trim();
    addMessage('user', userMessage);
    prompt = '';
    loading = true;

    try {
      const response = await fetch(`${SERVER_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: currentModel,
          messages: $messages.filter(m => m.role !== 'system').concat({ role: 'user', content: userMessage }),
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      let aiResponse = '';
      const aiMessageId = Date.now();
      addMessage('ai', '', aiMessageId);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const content = line.slice(6);
            if (content === '[DONE]') break;
            
            aiResponse += content;
            messages.update(msgs => msgs.map(msg =>
              msg.id === aiMessageId
                ? { ...msg, content: aiResponse }
                : msg
            ));
            scheduleScroll();
          }
        }
      }

    } catch (error) {
      console.error('Error in generateResponse:', error);
      addMessage('system', `An error occurred: ${error.message}`);
    } finally {
      loading = false;
      cancelScheduledScroll();
      smoothScrollToBottom();
      resetTextarea();
    }
  }

  function addMessage(role, content, id = Date.now()) {
    messages.update(msgs => [...msgs, { role, content, id }]);
    setTimeout(() => {
      smoothScrollToBottom();
      // Force a layout recalculation
      void messageContainer.offsetHeight;
    }, 0);
  }

  function handleScroll() {
    if (messageContainer) {
      const { scrollTop, scrollHeight, clientHeight } = messageContainer;
      isAtBottom = scrollTop + clientHeight >= scrollHeight - 10;
      showScrollButton = !isAtBottom;
    }
  }

  function scrollToBottom() {
    if (messageContainer) {
      messageContainer.scrollTop = messageContainer.scrollHeight;
    }
  }

  function scheduleScroll() {
    if (!scrollTimeout && Date.now() - lastScrollTime > SCROLL_INTERVAL) {
      scrollTimeout = setTimeout(() => {
        smoothScrollToBottom();
        scrollTimeout = null;
        lastScrollTime = Date.now();
      }, SCROLL_INTERVAL);
    } else {
      // Immediately scroll if within interval using requestAnimationFrame
      requestAnimationFrame(smoothScrollToBottom);
    }
  }

  function cancelScheduledScroll() {
    if (scrollTimeout) {
      clearTimeout(scrollTimeout);
      scrollTimeout = null;
    }
  }

  function smoothScrollToBottom() {
    if (messageContainer) {
      messageContainer.scrollTo({
        top: messageContainer.scrollHeight,
        behavior: 'smooth'
      });
    }
  }

  function handleTouchStart() {
    // Add this function definition
    // Implement any touch start logic if needed
  }

  function resetTextarea() {
    // Add this function definition
    if (textareaElement) {
      textareaElement.style.height = 'auto';
      textareaElement.style.height = Math.min(textareaElement.scrollHeight, parseInt(MAX_TEXTAREA_HEIGHT)) + 'px';
    }
  }

  // Function to sanitize and format message content
  function sanitizeMessageContent(content) {
    // Replace line breaks with <br> for proper HTML formatting
    return content
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br>");
  }
</script>

<svelte:head>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Quicksand:wght@400;700&display=swap" rel="stylesheet">
</svelte:head>

<svelte:window on:resize={handleResize} />

<div class="debug-log" id="debug-log"></div>
<main 
class="ai-chat" 
  class:dark-mode={isDarkMode} 
  in:fade={{ duration: 400 }}
  >
  <NavBar title = "Rhea"/>
  
  <div 
    class="message-container"
    bind:this={messageContainer}
    on:scroll={handleScroll}
    in:fade={{ duration: 400, delay: 200 }}
  >
    {#each $messages as message (message.id)}
      <div 
        class="message {message.role}"
        in:fly={{ y: 20, duration: 300 }}
        animate:flip={{ duration: 300 }}
      >
        <p>{@html sanitizeMessageContent(message.content)}</p>
      </div>
    {/each}
  </div>

  {#if showScrollButton}
    <button 
      class="scroll-to-bottom-btn"
      on:click={smoothScrollToBottom}
      in:fade={{ duration: 200 }}
      out:fade={{ duration: 200 }}
    >
      <div class="icon">
        <FaChevronDown />
      </div>
    </button>
  {/if}

  <footer class="input-area glass" class:keyboard-visible={isKeyboardVisible}>
    <form on:submit|preventDefault={generateResponse}>
      <textarea
        bind:this={textareaElement}
        bind:value={prompt}
        placeholder="Type a message..."
        rows="1"
        disabled={loading}
        on:input={resetTextarea}
        on:focus={handleFocus}
        on:blur={handleBlur}
        on:keydown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            generateResponse();
          }
        }}
      ></textarea>
      <button type="submit" disabled={loading || !prompt.trim() || !ollamaReady} class="send-button glassmorphic">
        <div class="icon">
          <FaPaperPlane />
        </div>
      </button>
    </form>
  </footer>
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

  .ai-chat {
    background-color: var(--bg-color);
    color: var(--text-color);
    display: flex;
    flex-direction: column;
    height: 100vh;
    max-width: 600px;
    margin: 0 auto;
    padding: 0;
    transition: opacity 0.5s ease, transform 0.5s ease;
  }

  .message-container {
    flex-grow: 1;
    overflow-y: auto;
    padding: 20px 10px 80px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    scrollbar-width: none; /* For Firefox */
    -ms-overflow-style: none;  /* For Internet Explorer and Edge */
  }

  .message-container::-webkit-scrollbar {
    display: none; /* For Chrome, Safari, and Opera */
  }

  .message-container > :first-child {
    margin-top: 15%;
  }

  .message-container > :last-child {
    margin-bottom: 8%;
  }

  .message {
    max-width: 80%;
    padding: 10px 15px;
    border-radius: 18px;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    word-break: break-word;
  }

  .message.user {
    align-self: flex-end;
    background-color: var(--user-message-bg);
    max-width: 76%;
  }

  .message.ai, .message.system {
    align-self: flex-start;
    max-width: 70%;
    background-color: var(--ai-message-bg);
  }

  .message.loading {
    background-color: #e6e6e6;
    color: #666;
    font-style: italic;
  }

  .input-area {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 12px 16px;
    background: rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(10px);
    box-shadow: 0 -1px 10px rgba(0, 0, 0, 0.05);
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  .input-area form {
    display: flex;
    gap: 8px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 24px;
    padding: 4px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
  }

  textarea {
    flex-grow: 1;
    padding: 10px 16px;
    border: none;
    border-radius: 20px;
    resize: none;
    font-family: inherit;
    font-size: 15px;
    line-height: 20px;
    height: 40px;
    overflow-y: hidden;
    background-color: transparent;
    color: var(--text-color);
    transition: height 0.2s ease;
    max-height: 100px;
    overflow-y: auto;
  }

  .send-button {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--primary-color);
    color: white;
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background-color 0.3s, transform 0.2s;
  }

  .send-button:hover:not(:disabled) {
    background: var(--secondary-color);
    transform: scale(1.05);
  }

  .send-button:disabled {
    background: rgba(204, 204, 204, 0.5);
    cursor: not-allowed;
  }

  .icon {
    width: 20px;
    height: 20px;
  }

  :global(.icon svg) {
    fill: currentColor;
  }

  .scroll-to-bottom-btn {
    position: fixed;
    bottom: 13%;
    right: 20px;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1); 
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: var(--text-color);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    transition: all 0.3s ease;
    z-index: 1001; 
  }

  .scroll-to-bottom-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: translateY(-2px);
    box-shadow: 0 6px 8px rgba(0, 0, 0, 0.15);
  }

  .scroll-to-bottom-btn .icon {
    opacity: 0.7;
  }

  @media (max-width: 600px) {
    .ai-chat {
      height: 100vh;
      width: 100%;
    }

    .message-container {
      padding-bottom: 100px;
    }

    .input-area {
      padding: 8px; /* Reduced padding for mobile */
    }

    textarea {
      font-size: 14px; /* Reduced font size for mobile */
    }
  }

  .message p {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
    font-size: 1.2em;
    line-height: 1.4;
  }

  .dot-animation {
    display: inline-block;
    width: 20px;
    animation: dotAnimation 1.5s infinite;
  }

  @keyframes dotAnimation {
    0%, 20% { content: '.'; }
    40%, 60% { content: '..'; }
    80%, 100% { content: '...'; }
  }

  /* Optional: Adjust specific elements for better readability */
  :global(textarea), :global(button) {
    font-family: 'Arial', sans-serif; /* Use a non-cursive font for input elements */
  }

  .message p {
    font-size: 1.2em; /* Increase font size for better readability */
    line-height: 1.4; /* Adjust line height for cursive font */
  }
  </style>
















