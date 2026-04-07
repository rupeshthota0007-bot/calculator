import { useState } from 'react';

const SECRET_CODE = '1456=';

function Calculator({ hidden, onUnlock }) {
  const [currentInput, setCurrentInput] = useState('0');
  const [previousInput, setPreviousInput] = useState('');
  const [operator, setOperator] = useState(null);
  const [awaitingNextValue, setAwaitingNextValue] = useState(false);
  const [inputSequence, setInputSequence] = useState('');

  const calculate = (first, second, op) => {
    if (op === '+') return first + second;
    if (op === '-') return first - second;
    if (op === '*') return first * second;
    if (op === '/') return first / second;
    if (op === '%') return (first / 100) * second;
    return second;
  };

  const handleKeyClick = (e) => {
     if (!e.target.matches('button')) return;
     const key = e.target;
     const action = key.dataset.action;
     const value = key.value;

     let nextSequence = inputSequence;
     if (action === 'calculate') {
         nextSequence += '=';
     } else if (value) {
         nextSequence += value;
     }

     if (nextSequence.endsWith(SECRET_CODE)) {
         onUnlock();
         setCurrentInput('0');
         setPreviousInput('');
         setOperator(null);
         setInputSequence('');
         return;
     }

     if (nextSequence.length > 20) {
         nextSequence = nextSequence.slice(-10);
     }
     setInputSequence(nextSequence);

     // execute standard calculator functions
     if (!action && value !== '.') {
         if (awaitingNextValue) {
             setCurrentInput(value);
             setAwaitingNextValue(false);
         } else {
             if (currentInput.length < 15) {
                 setCurrentInput(currentInput === '0' ? value : currentInput + value);
             }
         }
     } else if (value === '.') {
         if (!currentInput.includes('.')) {
             setCurrentInput(currentInput + '.');
         }
     } else if (action === 'operator') {
         const inputValue = parseFloat(currentInput);
         if (operator && awaitingNextValue) {
             setOperator(value);
             return;
         }
         if (previousInput === '') {
             setPreviousInput(currentInput);
         } else if (operator) {
             const result = String(calculate(parseFloat(previousInput), inputValue, operator));
             setCurrentInput(result.length > 15 ? result.substring(0, 15) : result);
             setPreviousInput(result.length > 15 ? result.substring(0, 15) : result);
         }
         setAwaitingNextValue(true);
         setOperator(value);
     } else if (action === 'calculate') {
         if (operator) {
             const result = String(calculate(parseFloat(previousInput), parseFloat(currentInput), operator));
             setCurrentInput(result.length > 15 ? result.substring(0, 15) : result);
             setOperator(null);
             setPreviousInput('');
             setAwaitingNextValue(true);
         }
     } else if (action === 'clear') {
         setCurrentInput('0');
         setPreviousInput('');
         setOperator(null);
         setAwaitingNextValue(false);
         setInputSequence('');
     } else if (action === 'delete') {
         if (!awaitingNextValue) {
             setCurrentInput(currentInput.slice(0, -1) || '0');
         }
     }
  };

  return (
    <div id="calculator-view" className={`view ${hidden ? 'hidden' : 'active'}`}>
      <div className="calc-display">{currentInput}</div>
      <div className="calc-keys" onClick={handleKeyClick}>
          <button className="key-op" data-action="clear">C</button>
          <button className="key-op" data-action="delete">⌫</button>
          <button className="key-op" data-action="operator" value="%">%</button>
          <button className="key-op" data-action="operator" value="/">÷</button>
          
          <button className="key-num" value="7">7</button>
          <button className="key-num" value="8">8</button>
          <button className="key-num" value="9">9</button>
          <button className="key-op" data-action="operator" value="*">×</button>
          
          <button className="key-num" value="4">4</button>
          <button className="key-num" value="5">5</button>
          <button className="key-num" value="6">6</button>
          <button className="key-op" data-action="operator" value="-">−</button>
          
          <button className="key-num" value="1">1</button>
          <button className="key-num" value="2">2</button>
          <button className="key-num" value="3">3</button>
          <button className="key-op" data-action="operator" value="+">+</button>
          
          <button className="key-num zero-btn" value="0">0</button>
          <button className="key-num" value=".">.</button>
          <button className="key-equals" data-action="calculate">=</button>
      </div>
    </div>
  );
}

export default Calculator;
