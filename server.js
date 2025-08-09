const express = require('express');
const path = require('path');
const app = express();

const PORT = process.env.PORT || 3000;

// Serve static files from flipbook-v2 directory
app.use(express.static('flipbook-v2'));

// Serve flipbook-v2/index.html for root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'flipbook-v2', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});