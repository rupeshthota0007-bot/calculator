// --- CALCULATOR LOGIC & SECRET CODE ---
const display = document.getElementById('calc-display');
const calcKeys = document.querySelector('.calc-keys');

let currentInput = '0';
let previousInput = '';
let operator = null;
let awaitingNextValue = false;
let inputSequence = ''; // Tracks keys to match the secret code
const SECRET_CODE = '1234='; // The unlock code

function updateDisplay() {
    display.textContent = currentInput;
}

function handleNumber(num) {
    if (awaitingNextValue) {
        currentInput = num;
        awaitingNextValue = false;
    } else {
        // Prevent multiple leading zeros, limit length
        if (currentInput.length < 15) {
            currentInput = currentInput === '0' ? num : currentInput + num;
        }
    }
}

function handleOperator(op) {
    const inputValue = parseFloat(currentInput);
    if (operator && awaitingNextValue) {
        operator = op;
        return;
    }
    if (previousInput == null || previousInput === '') {
        previousInput = currentInput;
    } else if (operator) {
        const result = calculate(parseFloat(previousInput), inputValue, operator);
        currentInput = String(result);
        if(currentInput.length > 15) currentInput = currentInput.substring(0, 15);
        previousInput = currentInput;
    }
    awaitingNextValue = true;
    operator = op;
}

function calculate(first, second, op) {
    if (op === '+') return first + second;
    if (op === '-') return first - second;
    if (op === '*') return first * second;
    if (op === '/') return first / second;
    if (op === '%') return (first / 100) * second;
    return second;
}

calcKeys.addEventListener('click', (e) => {
    if (!e.target.matches('button')) return;
    
    const key = e.target;
    const action = key.dataset.action;
    const value = key.value;

    // Track sequence for the custom secret code
    if (action === 'calculate') {
        inputSequence += '=';
    } else if (value) {
        inputSequence += value;
    }

    // Check code match
    if (inputSequence.endsWith(SECRET_CODE)) {
        inputSequence = ''; // reset sequence
        unlockChat();
        // Reset calc
        currentInput = '0';
        previousInput = '';
        operator = null;
        updateDisplay();
        return; 
    }
    // Keep sequence reasonably small
    if (inputSequence.length > 20) {
        inputSequence = inputSequence.slice(-10);
    }

    // Execute standard calculator functions
    if (!action && value !== '.') {
        handleNumber(value);
    } else if (value === '.') {
        if (!currentInput.includes('.')) {
            currentInput += '.';
        }
    } else if (action === 'operator') {
        handleOperator(value);
    } else if (action === 'calculate') {
        if (operator) {
            currentInput = String(calculate(parseFloat(previousInput), parseFloat(currentInput), operator));
            if(currentInput.length > 15) currentInput = currentInput.substring(0, 15);
            operator = null;
            previousInput = '';
            awaitingNextValue = true;
        }
    } else if (action === 'clear') {
        currentInput = '0';
        previousInput = '';
        operator = null;
        awaitingNextValue = false;
        inputSequence = '';
    } else if (action === 'delete') {
        if(!awaitingNextValue) {
            currentInput = currentInput.slice(0, -1) || '0';
        }
    }

    updateDisplay();
});

// --- VIEWS ---
const calcView = document.getElementById('calculator-view');
const authView = document.getElementById('auth-view');
const recentChatsView = document.getElementById('recent-chats-view');
const chatView = document.getElementById('chat-view');

function switchView(fromView, toView) {
    fromView.classList.remove('active');
    fromView.classList.add('hidden');
    toView.classList.remove('hidden');
    setTimeout(() => {
        toView.classList.add('active');
    }, 50);
}

function unlockChat() {
    switchView(calcView, authView);
}

// --- AUTH LOGIC ---
const authTitle = document.getElementById('auth-title');
const authSubtitle = document.getElementById('auth-subtitle');
const authForm = document.getElementById('auth-form');
const authUsername = document.getElementById('auth-username');
const authPassword = document.getElementById('auth-password');
const authSubmitBtn = document.getElementById('auth-submit-btn');
const authSwitchText = document.getElementById('auth-switch-text');
const authSwitchLink = document.getElementById('auth-switch-link');

let isLoginMode = true;
let currentUser = null;

authSwitchLink.addEventListener('click', (e) => {
    e.preventDefault();
    isLoginMode = !isLoginMode;
    if (isLoginMode) {
        authTitle.textContent = "Secure Login";
        authSubtitle.textContent = "Access your encrypted channels";
        authSubmitBtn.textContent = "Login";
        authSwitchText.textContent = "Don't have an account?";
        authSwitchLink.textContent = "Register";
    } else {
        authTitle.textContent = "Register";
        authSubtitle.textContent = "Create an encrypted channel ID";
        authSubmitBtn.textContent = "Register";
        authSwitchText.textContent = "Already have an account?";
        authSwitchLink.textContent = "Login";
    }
});

authForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = authUsername.value.trim().toLowerCase();
    const password = authPassword.value.trim();
    
    if (username.length < 3) {
        alert("Username must be at least 3 characters."); return;
    }
    
    const accounts = JSON.parse(localStorage.getItem('calc_accounts')) || {};
    
    if (!isLoginMode) {
        if (accounts[username]) {
            alert("Username already taken."); return;
        }
        // Save user
        const uniqueId = username + '-' + Math.floor(1000 + Math.random() * 9000);
        accounts[username] = { password: password, id: uniqueId };
        localStorage.setItem('calc_accounts', JSON.stringify(accounts));
        alert("Registered successfully! Logging in...");
        loginUser(username, accounts);
    } else {
        const user = accounts[username];
        if (user && user.password === password) {
            loginUser(username, accounts);
        } else {
            alert("Invalid credentials.");
        }
    }
});

function loginUser(username, accounts) {
    currentUser = { username: username, id: accounts[username].id };
    
    // We no longer persist 'calc_chat_user' to force login every time they unlock.
    
    authUsername.value = '';
    authPassword.value = '';
    
    switchView(authView, recentChatsView);
    initializePeer(currentUser.id);
    renderRecentChats();
}

document.getElementById('logout-btn').addEventListener('click', () => {
    currentUser = null;
    if(peer) { peer.destroy(); peer = null; }
    // Lock the application and return to calculator view
    switchView(recentChatsView, calcView); 
});

// --- RECENT CHATS LOGIC ---
const myPeerIdDisplay = document.getElementById('my-peer-id-display');
const recentList = document.getElementById('recent-list');
const newChatFab = document.getElementById('new-chat-fab');
const backToRecentBtn = document.getElementById('back-to-recent-btn');

let recentChats = JSON.parse(localStorage.getItem('calc_recent_chats')) || [];

function renderRecentChats() {
    recentList.innerHTML = '';
    
    if (recentChats.length === 0) {
        recentList.innerHTML = `<div style="text-align:center; padding: 40px; color: var(--text-muted);">
            No recent chats.<br>Click the + button to start a new connection.
        </div>`;
        return;
    }
    
    recentChats.forEach(chat => {
        const div = document.createElement('div');
        div.className = 'chat-item';
        div.innerHTML = `
            <div class="chat-item-avatar"><ion-icon name="person"></ion-icon></div>
            <div class="chat-item-info">
                <div class="chat-item-header">
                    <span class="chat-item-name">${escapeHTML(chat.id)}</span>
                    <span class="chat-item-time">${chat.time || ''}</span>
                </div>
                <div class="chat-item-snippet">${escapeHTML(chat.lastMessage || 'No recent messages')}</div>
            </div>
        `;
        div.addEventListener('click', () => {
             openChat(chat.id);
        });
        recentList.appendChild(div);
    });
}

function saveRecentChat(targetId, lastMessageText) {
    const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    let existingIndex = recentChats.findIndex(c => c.id === targetId);
    if (existingIndex !== -1) {
        recentChats[existingIndex].lastMessage = lastMessageText;
        recentChats[existingIndex].time = timeString;
        const chat = recentChats.splice(existingIndex, 1)[0];
        recentChats.unshift(chat);
    } else {
        recentChats.unshift({ id: targetId, lastMessage: lastMessageText, time: timeString });
    }
    localStorage.setItem('calc_recent_chats', JSON.stringify(recentChats));
    if (recentChatsView.classList.contains('active')) {
        renderRecentChats();
    }
}

newChatFab.addEventListener('click', () => {
    const targetId = prompt('Enter the Peer ID of the person you want to connect to:');
    if (targetId && currentUser && targetId !== currentUser.id) {
        openChat(targetId);
    }
});

let currentChatTarget = null;
function openChat(targetId) {
    currentChatTarget = targetId;
    switchView(recentChatsView, chatView);
    chatMessages.innerHTML = `
        <div class="message received">
            <p><strong>System:</strong> Attempting to connect to ${targetId}...</p>
        </div>
    `;
    connectionStatus.textContent = `Target: ${targetId}`;
    connectionStatus.style.color = '';
    
    if (peer && peer.open) {
        currentConn = peer.connect(targetId);
        setupConnection(currentConn);
    }
}

backToRecentBtn.addEventListener('click', () => {
    switchView(chatView, recentChatsView);
    renderRecentChats();
    currentChatTarget = null;
    // We optionally leave connection open
});

// Interacting with the chat
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const chatMessages = document.getElementById('chat-messages');
const connectionStatus = document.getElementById('connection-status');

let peer = null;
let currentConn = null;
let myPeerId = null;

function initializePeer(customId) {
    if (peer) return; // already initialized
    peer = new Peer(customId);
    
    peer.on('open', (id) => {
        myPeerId = id;
        myPeerIdDisplay.textContent = `ID: ${id}`;
    });

    peer.on('connection', (conn) => {
        // Someone connected to us
        currentConn = conn;
        setupConnection(conn);
        saveRecentChat(conn.peer, "Incoming connection...");
        if (!chatView.classList.contains('active')) {
            alert(`New connection request from ${conn.peer}! Check your chats.`);
        }
    });

    peer.on('call', (call) => {
        // Expose to global scope for the accept/reject handlers
        window.incomingCallObj = call;
        const callerIdDisplay = document.getElementById('caller-id-display');
        if(callerIdDisplay) callerIdDisplay.textContent = call.peer;
        const modal = document.getElementById('incoming-call-modal');
        if(modal) modal.classList.remove('hidden');
    });
}

function setupConnection(conn) {
    conn.on('open', () => {
        connectionStatus.textContent = `Connected to: ${conn.peer}`;
        connectionStatus.style.color = 'var(--accent)';
        if (currentChatTarget === conn.peer && chatView.classList.contains('active')) {
            const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const sysDiv = document.createElement('div');
            sysDiv.className = 'message received';
            sysDiv.style.background = 'var(--msg-sent)';
            sysDiv.innerHTML = `<p><strong>System:</strong> Securely connected.</p><span class="time">${timeString}</span>`;
            chatMessages.appendChild(sysDiv);
            scrollToBottom();
        }
    });
    
    conn.on('data', (data) => {
        receiveMessage(data);
    });
    
    conn.on('close', () => {
        connectionStatus.textContent = `ID: ${myPeerId}`;
        connectionStatus.style.color = '';
        currentConn = null;
        alert('Peer disconnected.');
    });
}

function receiveMessage(data) {
    const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // Support legacy string messages and new object-based messages
    let type = 'text';
    let content = data;
    if (typeof data === 'object' && data.type && data.content) {
        type = data.type;
        content = data.content;
    }
    
    if (currentConn && chatView.classList.contains('active') && currentChatTarget === currentConn.peer) {
        const replyDiv = document.createElement('div');
        replyDiv.className = 'message received';
        if (type === 'image') {
            replyDiv.innerHTML = `
                <img src="${content}" class="chat-image" alt="Received Image">
                <span class="time">${timeString}</span>
            `;
        } else {
            replyDiv.innerHTML = `
                <p>${escapeHTML(content)}</p>
                <span class="time">${timeString}</span>
            `;
        }
        chatMessages.appendChild(replyDiv);
        scrollToBottom();
    }
    
    if (currentConn) {
        const recentText = type === 'image' ? '📷 Image' : content;
        saveRecentChat(currentConn.peer, recentText);
        if (!chatView.classList.contains('active') || currentChatTarget !== currentConn.peer) {
             // Play notification sound or something if we wanted
             renderRecentChats(); // refresh list
        }
    }
}

function sendMessage() {
    const text = messageInput.value.trim();
    if (!text) return;

    const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Build Sent Message
    const msgDiv = document.createElement('div');
    msgDiv.className = 'message sent';
    msgDiv.innerHTML = `
        <p>${escapeHTML(text)}</p>
        <span class="time">${timeString}</span>
    `;
    
    chatMessages.appendChild(msgDiv);
    messageInput.value = '';
    scrollToBottom();

    // Send via PeerJS if connected
    if (currentConn && currentConn.open) {
        currentConn.send({ type: 'text', content: text });
        saveRecentChat(currentConn.peer, text);
    } else {
        showMockFeedback(timeString);
    }
}

function showMockFeedback(timeString) {
    const sysDiv = document.createElement('div');
    sysDiv.className = 'message received';
    sysDiv.style.background = 'rgba(255, 0, 0, 0.1)';
    sysDiv.innerHTML = `
        <p><i>System: Message not sent. You are not connected.</i></p>
        <span class="time">${timeString}</span>
    `;
    chatMessages.appendChild(sysDiv);
    scrollToBottom();
}

function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag]));
}

sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

// --- IMAGE UPLOAD LOGIC ---
const attachBtn = document.getElementById('attach-btn');
const imageUploadInput = document.getElementById('image-upload-input');

if (attachBtn && imageUploadInput) {
    attachBtn.addEventListener('click', () => {
        imageUploadInput.click();
    });

    imageUploadInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            alert('Please select an image file to share.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const base64Data = event.target.result;
            sendImageMessage(base64Data);
        };
        reader.readAsDataURL(file);
        
        imageUploadInput.value = ''; // Reset input to allow re-upload 
    });
}

function sendImageMessage(base64Data) {
    const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const msgDiv = document.createElement('div');
    msgDiv.className = 'message sent';
    msgDiv.innerHTML = `
        <img src="${base64Data}" class="chat-image" alt="Sent Image">
        <span class="time">${timeString}</span>
    `;
    chatMessages.appendChild(msgDiv);
    scrollToBottom();

    if (currentConn && currentConn.open) {
        currentConn.send({ type: 'image', content: base64Data });
        saveRecentChat(currentConn.peer, '📷 Image');
    } else {
        showMockFeedback(timeString);
    }
}

// Real Actions: Connect & Share (legacy connect button, although we use FAB mostly now)
// We will retain the connect btn functionality inside chat view but it's redundant mostly.
document.getElementById('connect-btn').addEventListener('click', () => {
    if (!peer || !myPeerId) {
        alert('Please wait for your Peer ID to generate.');
        return;
    }
    const targetId = prompt('Enter the Peer ID of the person you want to connect to:');
    if (targetId && targetId !== myPeerId) {
        currentChatTarget = targetId;
        currentConn = peer.connect(targetId);
        setupConnection(currentConn);
    } // else do nothing
});

if (document.getElementById('share-id-btn')) {
    document.getElementById('share-id-btn').addEventListener('click', () => {
        if (myPeerId) {
            navigator.clipboard.writeText(myPeerId).then(() => {
                alert(`Your SECURE PEER ID: ${myPeerId} has been copied to your clipboard.\nPaste and send it to your friend!`);
            }).catch(() => {
                prompt("Copy your SECURE PEER ID below:", myPeerId);
            });
        }
    });
}

// --- AUDIO CALLS LOGIC ---
let localStream = null;
let currentCall = null;
let callTimerInterval = null;
let callSeconds = 0;
window.incomingCallObj = null;

async function getLocalAudioStream() {
    if (localStream) return localStream;
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        return localStream;
    } catch (err) {
        console.error('Failed to get local audio', err);
        alert('Could not access microphone. Please check your browser permissions.');
        return null;
    }
}

function updateCallTimer() {
    callSeconds++;
    const mins = String(Math.floor(callSeconds / 60)).padStart(2, '0');
    const secs = String(callSeconds % 60).padStart(2, '0');
    const td = document.getElementById('call-timer-display');
    if (td) td.textContent = `${mins}:${secs}`;
}

function startCallTimer() {
    callSeconds = 0;
    const td = document.getElementById('call-timer-display');
    if (td) td.textContent = '00:00';
    callTimerInterval = setInterval(updateCallTimer, 1000);
}

function stopCallTimer() {
    if (callTimerInterval) clearInterval(callTimerInterval);
}

function endCallCleanup() {
    if (currentCall) {
        currentCall.close();
        currentCall = null;
    }
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    stopCallTimer();
    const ab = document.getElementById('active-call-banner');
    if (ab) ab.classList.add('hidden');
    const modal = document.getElementById('incoming-call-modal');
    if (modal) modal.classList.add('hidden');
    window.incomingCallObj = null;
}

function setupCallEvents(call) {
    currentCall = call;
    call.on('stream', (remoteStream) => {
        const audioEl = document.getElementById('remote-audio');
        if (audioEl) {
            audioEl.srcObject = remoteStream;
            audioEl.play().catch(e => console.log('Autoplay prevented', e));
        }
        const ab = document.getElementById('active-call-banner');
        if (ab) ab.classList.remove('hidden');
        startCallTimer();
    });
    call.on('close', () => {
        endCallCleanup();
    });
    call.on('error', (err) => {
        console.error(err);
        endCallCleanup();
    });
}

document.getElementById('call-btn').addEventListener('click', async () => {
    if (!peer || !currentChatTarget) {
        alert('Please connect to a peer first.');
        return;
    }
    const stream = await getLocalAudioStream();
    if (!stream) return;
    
    const call = peer.call(currentChatTarget, stream);
    setupCallEvents(call);
    
    document.getElementById('active-call-banner').classList.remove('hidden');
    document.getElementById('call-timer-display').textContent = 'Calling...';
});

document.getElementById('accept-call-btn').addEventListener('click', async () => {
    document.getElementById('incoming-call-modal').classList.add('hidden');
    if (!window.incomingCallObj) return;
    const stream = await getLocalAudioStream();
    if (!stream) {
        window.incomingCallObj.close();
        return;
    }
    window.incomingCallObj.answer(stream);
    setupCallEvents(window.incomingCallObj);
    window.incomingCallObj = null;
});

document.getElementById('reject-call-btn').addEventListener('click', () => {
    document.getElementById('incoming-call-modal').classList.add('hidden');
    if (window.incomingCallObj) {
        window.incomingCallObj.close();
        window.incomingCallObj = null;
    }
});

document.getElementById('end-call-btn').addEventListener('click', () => {
    endCallCleanup();
});

document.getElementById('share-btn').addEventListener('click', () => {
    if (myPeerId) {
        navigator.clipboard.writeText(myPeerId).then(() => {
            alert(`Your SECURE PEER ID: ${myPeerId} has been copied to your clipboard.\nPaste and send it to your friend!`);
        }).catch(() => {
            // fallback if clipboard fails
            prompt("Copy your SECURE PEER ID below:", myPeerId);
        });
    } else {
        alert('Your Peer ID is still generating. Please wait a moment.');
    }
});
