<script>
  import { onMount, tick } from 'svelte';
  import ollama from 'ollama';
  import { fade, fly, scale, slide } from 'svelte/transition';
  import { spring } from 'svelte/motion';
  import { flip } from 'svelte/animate';
  import FaPaperPlane from 'svelte-icons/fa/FaPaperPlane.svelte';
  import FaChevronDown from 'svelte-icons/fa/FaChevronDown.svelte';
  import NavBar from './NavBar.svelte';
  import { darkMode } from '$lib/stores';

  let prompt = '';
  let messages = [];
  let loading = false;
  let ollamaReady = false;
  let messageContainer;
  let isAtBottom = true;
  let showScrollButton = false;
  let currentStreamingMessage = '';
  let messageHistory = [];
  let isDarkMode = false;

  const pageLoaded = spring(0);

  let scrollTimeout;
  let lastScrollTime = 0;
  const SCROLL_INTERVAL = 500; // ms between scroll updates

  let textareaElement;

  const MAX_TEXTAREA_HEIGHT = '100px'; // Set a maximum height for the textarea

  function resetTextarea() {
    if (textareaElement) {
      textareaElement.style.height = 'auto';
      const newHeight = Math.min(textareaElement.scrollHeight, parseInt(MAX_TEXTAREA_HEIGHT));
      textareaElement.style.height = `${newHeight}px`;
    }
  }

  onMount(async () => {
    try {
      await ollama.list();
      ollamaReady = true;
    } catch (error) {
      console.error('Ollama check failed:', error);
      addMessage('system', 'Error: Ollama service is not available. Please make sure it\'s running.');
    }
    pageLoaded.set(1);
    resetTextarea(); // Reset textarea height on mount
  });

  darkMode.subscribe((value) => {
		isDarkMode = value;
	});

  function smoothScrollToBottom() {
    if (messageContainer) {
      const scrollTarget = messageContainer.scrollHeight - messageContainer.clientHeight;
      messageContainer.scrollTo({
        top: scrollTarget,
        behavior: 'smooth'
      });
    }
  }

  async function generateResponse() {
    if (!ollamaReady) {
      addMessage('system', 'Error: Ollama service is not ready. Please try again later.');
      return;
    }

    if (!prompt.trim()) return;

    const userMessage = prompt.trim();
    addMessage('user', userMessage);
    prompt = '';
    loading = true;

    let buffer = '';
    let isInBoldSection = false;

    try {
      const stream = await ollama.chat({
        model: 'llama3.2:latest',
        messages: [...messageHistory, { role: 'user', content: userMessage }],
        stream: true,
      });

      const aiMessageId = Date.now();
      addMessage('ai', '', aiMessageId);
      scheduleScroll(); // Initial scroll when AI starts responding
      
      for await (const chunk of stream) {
        let word = chunk.message.content;
        buffer += word;

        while (buffer.includes('**')) {
          const startIndex = buffer.indexOf('**');
          const endIndex = buffer.indexOf('**', startIndex + 2);

          if (endIndex !== -1) {
            // We have a complete bold section
            const boldText = buffer.slice(startIndex + 2, endIndex);
            const beforeBold = buffer.slice(0, startIndex);
            const afterBold = buffer.slice(endIndex + 2);
            
            messages = messages.map(msg => 
              msg.id === aiMessageId 
                ? { ...msg, content: msg.content + beforeBold + '<strong>' + boldText + '</strong>' } 
                : msg
            );
            
            buffer = afterBold;
          } else {
            // Incomplete bold section, wait for more chunks
            break;
          }
        }

        // Append any remaining non-bold text
        if (buffer && !buffer.includes('**')) {
          messages = messages.map(msg => 
            msg.id === aiMessageId 
              ? { ...msg, content: msg.content + buffer } 
              : msg
          );
          buffer = '';
        }

        // Remove this line to prevent constant re-rendering
        // await tick();
        // smoothScrollToBottom(); // Scroll after each chunk

        scheduleScroll(); // Schedule a scroll after processing each chunk
      }
      
      // Append any remaining text in the buffer
      if (buffer) {
        messages = messages.map(msg => 
          msg.id === aiMessageId 
            ? { ...msg, content: msg.content + buffer } 
            : msg
        );
      }
      
      // Update message history after streaming is complete
      messageHistory = [...messageHistory, 
        { role: 'user', content: userMessage },
        { role: 'ai', content: messages[messages.length - 1].content }
      ];
    } catch (error) {
      console.error('Error:', error);
      addMessage('system', `An error occurred: ${error.message}`);
    } finally {
      currentStreamingMessage = '';
      loading = false;
      cancelScheduledScroll();
      smoothScrollToBottom();
      
      // Animate textarea back to one row
      if (textareaElement) {
        textareaElement.style.transition = 'height 0.3s ease';
        textareaElement.style.height = 'auto';
        setTimeout(() => {
          textareaElement.style.transition = '';
        }, 300);
      }
      resetTextarea(); // Reset textarea height after sending message
    }
  }

  function addMessage(role, content, id = Date.now()) {
    messages = [...messages, { role, content, id }];
    setTimeout(() => {
      smoothScrollToBottom(); // Scroll after adding a new message
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
    }
  }

  function cancelScheduledScroll() {
    if (scrollTimeout) {
      clearTimeout(scrollTimeout);
      scrollTimeout = null;
    }
  }
</script>

<svelte:head>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Quicksand:wght@400;700&display=swap" rel="stylesheet">
</svelte:head>

<main class="ai-chat" class:dark-mode={isDarkMode} in:fade={{ duration: 400 }}>
  <NavBar title = "Rhea"/>
  
  <div 
    class="message-container"
    bind:this={messageContainer}
    on:scroll={handleScroll}
    in:fade={{ duration: 400, delay: 200 }}
  >
    {#each messages as message (message.id)}
      <div 
        class="message {message.role}"
        in:fly={{ y: 20, duration: 300 }}
        animate:flip={{ duration: 300 }}
      >
        <p>{@html message.content.replace(/\n/g, '<br>')}</p>
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

  <footer class="input-area glass">
    <form on:submit|preventDefault={generateResponse}>
      <textarea
        bind:this={textareaElement}
        bind:value={prompt}
        placeholder="Type a message..."
        rows="1"
        disabled={loading}
        on:input={resetTextarea}
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
  }

  .message.ai, .message.system {
    align-self: flex-start;
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

