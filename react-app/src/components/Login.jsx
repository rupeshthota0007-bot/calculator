import { useState } from 'react';

function Login({ hidden, onLogin, onGoToRegister }) {
  const [view, setView] = useState('login'); // 'login' | 'forgot'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  const handleLogin = (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setMessage('Username and password are required.');
      return;
    }

    const existingUsers = JSON.parse(localStorage.getItem('secureUsersData') || '{}');
    const user = existingUsers[username];
    
    if (!user || user.password !== password) {
      setMessage('Invalid username or password.');
      return;
    }

    // Login success
    onLogin(username);
  };

  const handleForgot = (e) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) {
      setMessage('Please enter a valid email address.');
      return;
    }
    // Mock email sent
    setMessage(`Reset link sent to ${email}`);
    setTimeout(() => {
        setView('login');
        setMessage('');
        setEmail('');
    }, 2500);
  };

  return (
    <div id="login-view" className={`view ${hidden ? 'hidden' : 'active'}`}>
      <div className="login-container">
        {view === 'login' ? (
          <form className="login-form" onSubmit={handleLogin}>
            <h2>Welcome Back</h2>
            <p className="subtitle">Secure Channel Authentication</p>
            
            {message && <p className={`message-box ${message.includes('sent') ? 'success' : 'error'}`}>{message}</p>}

            <div className="input-group">
              <ion-icon name="person-outline"></ion-icon>
              <input 
                type="text" 
                placeholder="Username" 
                value={username} 
                onChange={(e) => setUsername(e.target.value)} 
              />
            </div>

            <div className="input-group">
              <ion-icon name="lock-closed-outline"></ion-icon>
              <input 
                type="password" 
                placeholder="Password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
              />
            </div>

            <button type="submit" className="login-btn">Secure Login</button>

            <div className="form-footer">
              <span className="link" onClick={() => { setView('forgot'); setMessage(''); }}>
                Forgot Password?
              </span>
              <span className="divider">|</span>
              <span className="link" onClick={() => { onGoToRegister(); setMessage(''); }}>
                Create Account
              </span>
            </div>
          </form>
        ) : (
          <form className="login-form" onSubmit={handleForgot}>
            <h2>Reset Password</h2>
            <p className="subtitle">Enter your email to receive a secure link.</p>

            {message && <p className={`message-box ${message.includes('sent') ? 'success' : 'error'}`}>{message}</p>}

            <div className="input-group">
              <ion-icon name="mail-outline"></ion-icon>
              <input 
                type="email" 
                placeholder="Email Address" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
              />
            </div>

            <button type="submit" className="login-btn reset-btn">Send Link</button>

            <div className="form-footer">
              <span className="link" onClick={() => { setView('login'); setMessage(''); }}>
                Back to Login
              </span>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default Login;
