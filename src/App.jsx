import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

function App() {
  const [status, setStatus] = useState('checking');
  const [message, setMessage] = useState('Checking Supabase connection...');

  useEffect(() => {
    checkConnection();
  }, []);

  async function checkConnection() {
    const { error } = await supabase.rpc('profile_value_exists', {
      check_column: 'email',
      check_value: 'connection-check@example.invalid',
    });

    if (error) {
      setStatus('error');
      setMessage(
        `Supabase connected, but database schema/RLS check failed: ${error.message}`
      );
      return;
    }

    setStatus('success');
    setMessage('Supabase database connection is working correctly.');
  }

  return (
    <main style={{ fontFamily: 'Arial, sans-serif', padding: 24 }}>
      <h1>Student Digital Locker</h1>
      <p>
        <strong>Status:</strong> {status}
      </p>
      <p>{message}</p>
    </main>
  );
}

export default App;
