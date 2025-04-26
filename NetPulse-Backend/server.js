const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const app = express();

app.use(express.json());

// Supabase setup
const supabaseUrl = 'https://wjnstfgsrwgctcbwhtnh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqbnN0ZmdzcndnY3RjYndodG5oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU2NTIzNjksImV4cCI6MjA2MTIyODM2OX0.Ti4J_roZnLMhF6PTvSbVU4AM1hQcauSQ3C5iwo1djJg';
const supabase = createClient(supabaseUrl, supabaseKey);

// Test route
app.get('/', (req, res) => res.send('NetPulse Backend Running!'));

// Get devices
app.get('/devices', async (req, res) => {
  const { data, error } = await supabase.from('devices').select('*');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));