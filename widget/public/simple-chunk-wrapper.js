// Simple script to fetch and wrap the Next.js chunk in a self-invoking function
(function() {
  // The URL of the chunk to wrap
  const chunkUrl = 'https://vogo-chatbot.vogo.family/_next/static/chunks/4bd1b696-640aabc2b96c0448.js';
  
  // Fetch the chunk content
  fetch(chunkUrl)
    .then(response => {
      if (!response.ok) {
        throw new Error(`Failed to fetch chunk: ${response.status}`);
      }
      return response.text();
    })
    .then(chunkContent => {
      // Create a new script element with the wrapped content
      const script = document.createElement('script');
      script.textContent = `(function(){${chunkContent}})();`;
      
      // Add it to the document
      document.head.appendChild(script);
      console.log('Chunk wrapped and executed with self-invoking function');
    })
    .catch(error => {
      console.error('Error wrapping chunk:', error);
    });
})();
