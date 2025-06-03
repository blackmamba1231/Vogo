// Vogo.Family Simple Widget Embed
(function() {
  // Create a simple chat button
  const button = document.createElement('button');
  button.id = 'vogo-chat-button';
  button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';
  button.style.position = 'fixed';
  button.style.bottom = '20px';
  button.style.right = '20px';
  button.style.width = '60px';
  button.style.height = '60px';
  button.style.borderRadius = '50%';
  button.style.backgroundColor = '#30653e';
  button.style.color = 'white';
  button.style.border = 'none';
  button.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)';
  button.style.cursor = 'pointer';
  button.style.zIndex = '9999';
  button.style.display = 'flex';
  button.style.alignItems = 'center';
  button.style.justifyContent = 'center';
  document.body.appendChild(button);

  // Create iframe container (initially hidden)
  const container = document.createElement('div');
  container.id = 'vogo-widget-container';
  container.style.position = 'fixed';
  container.style.bottom = '90px';
  container.style.right = '20px';
  container.style.width = '350px';
  container.style.height = '500px';
  container.style.backgroundColor = 'white';
  container.style.borderRadius = '10px';
  container.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
  container.style.zIndex = '9998';
  container.style.overflow = 'hidden';
  container.style.display = 'none'; // Initially hidden
  document.body.appendChild(container);

  // Create an iframe to load the widget
  const iframe = document.createElement('iframe');
  iframe.src = 'https://vogo-chatbot.vogo.family';
  iframe.style.width = '100%';
  iframe.style.height = '100%';
  iframe.style.border = 'none';
  container.appendChild(iframe);

  // Toggle widget visibility when button is clicked
  button.addEventListener('click', function() {
    const isVisible = container.style.display !== 'none';
    container.style.display = isVisible ? 'none' : 'block';
  });

  console.log('Vogo.Family Chat Widget loaded successfully');
})();
