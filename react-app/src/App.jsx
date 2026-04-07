import { useState } from 'react';
import Calculator from './components/Calculator';
import Register from './components/Register';
import Login from './components/Login';
import Chat from './components/Chat';
import './index.css';

function App() {
  const [appStage, setAppStage] = useState('calculator'); // 'calculator', 'register', 'login', 'chat'
  const [currentUser, setCurrentUser] = useState('');

  const handleCalculatorUnlock = () => {
    // Default to Register screen upon unlock
    setAppStage('register');
  };

  const handleRegisterSuccess = (username) => {
    // Navigate to login after registration success or skip straight to login
    setAppStage('login');
  };

  const handleLogin = (username) => {
    setCurrentUser(username);
    setAppStage('chat');
  };

  const handleLogout = () => {
    setCurrentUser('');
    setAppStage('calculator');
  };

  return (
    <div className="app-container">
      <Calculator 
        hidden={appStage !== 'calculator'} 
        onUnlock={handleCalculatorUnlock} 
      />
      <Register 
        hidden={appStage !== 'register'} 
        onRegisterClick={handleRegisterSuccess}
        onGoToLogin={() => setAppStage('login')}
      />
      <Login 
        hidden={appStage !== 'login'} 
        onLogin={handleLogin}
        onGoToRegister={() => setAppStage('register')}
      />
      <Chat 
        hidden={appStage !== 'chat'} 
        currentUser={currentUser}
        onLogout={handleLogout}
      />
    </div>
  );
}

export default App;
