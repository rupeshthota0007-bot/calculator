import { useState } from 'react';

function Register({ hidden, onRegisterClick, onGoToLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  const handleRegister = (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setMessage('Username and password are required.');
      return;
    }

    const existingUsers = JSON.parse(localStorage.getItem('secureUsersData') || '{}');
    if (existingUsers[username]) {
      setMessage('Username already exists.');
      return;
    }

    existingUsers[username] = { password, email };
    localStorage.setItem('secureUsersData', JSON.stringify(existingUsers));

    setMessage('Registration successful! Redirecting...');
    setTimeout(() => {
        onRegisterClick(username);
    }, 1500);
  };

  return (
    <div id="register-view" className={`view ${hidden ? 'hidden' : 'active'}`}>
      <div className="login-container">
        <form className="login-form" onSubmit={handleRegister}>
          <h2>Create Account</h2>
          <p className="subtitle">Secure Channel Registration</p>
          
          {message && <p className={`message-box ${message.includes('success') ? 'success' : 'error'}`}>{message}</p>}

          <div className="input-group">
            <ion-icon name="person-outline"></ion-icon>
            <input 
              type="text" 
              placeholder="Choose Username" 
              value={username} 
              onChange={(e) => setUsername(e.target.value)} 
            />
          </div>

          <div className="input-group">
            <ion-icon name="mail-outline"></ion-icon>
            <input 
              type="email" 
              placeholder="Email (Optional)" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
            />
          </div>

          <div className="input-group">
            <ion-icon name="lock-closed-outline"></ion-icon>
            <input 
              type="password" 
              placeholder="Choose Password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
            />
          </div>

          <button type="submit" className="login-btn">Register</button>

          <div className="form-footer">
            <span className="link" onClick={() => { onGoToLogin(); setMessage(''); }}>
              Already registered? Login
            </span>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Register;
