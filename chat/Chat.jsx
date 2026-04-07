import { useState, useEffect, useRef } from 'react';
import Peer from 'peerjs';

const generatePermanentId = () => {
    let id = localStorage.getItem('myPermanentPeerId');
    if (!id) {
        id = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
        localStorage.setItem('myPermanentPeerId', id);
    }
    return id;
};

// Sub-component to render multiple audio streams
function AudioStreamPlayer({ stream }) {
    const audioRef = useRef(null);
    useEffect(() => {
        if (audioRef.current && stream) {
            audioRef.current.srcObject = stream;
        }
    }, [stream]);
    return <audio ref={audioRef} autoPlay />;
}

function Chat({ hidden, currentUser, onLogout }) {
    const [peer, setPeer] = useState(null);
    const [myPeerId, setMyPeerId] = useState('');
    const [connection, setConnection] = useState(null);
    const [activeContact, setActiveContact] = useState(null);
    const [chatView, setChatView] = useState('list');

    const [allChats, setAllChats] = useState(() => {
        const saved = localStorage.getItem('secureChatsData');
        if (saved) {
            try { return JSON.parse(saved); } catch (e) { console.error("Parse error", e); }
        }
        return {};
    });

    const [messages, setMessages] = useState([{
        id: 1, type: 'received', text: 'Welcome to the secure channel. Connect to a peer to start messaging.', time: 'Now'
    }]);

    const [inputText, setInputText] = useState('');

    // Audio Call States (Group Calling)
    const [activeCalls, setActiveCalls] = useState({}); // { [peerId]: callObj }
    const [incomingCalls, setIncomingCalls] = useState([]); // array of call objs ringing
    const [remoteStreams, setRemoteStreams] = useState({}); // { [peerId]: MediaStream }

    const localStreamRef = useRef(null);
    const chatMessagesRef = useRef(null);
    const isCallingAny = Object.keys(activeCalls).length > 0;

    useEffect(() => {
        if (activeContact) {
            setAllChats(prev => {
                const updated = { ...prev, [activeContact]: messages };
                localStorage.setItem('secureChatsData', JSON.stringify(updated));
                return updated;
            });
        }
    }, [messages, activeContact]);

    const switchToContact = (contactId) => {
        setActiveContact(contactId);
        setChatView('conversation');
        setAllChats(prev => {
            const history = prev[contactId];
            if (history && history.length > 0) {
                setMessages(history);
            } else {
                setMessages([{
                    id: Date.now(), type: 'received', text: 'System: Started secure channel with ' + contactId, time: 'Now'
                }]);
            }
            return prev;
        });
    };

    const addMessage = (text, type = 'received', isSystem = false, senderName = null, isImage = false) => {
        const timeString = isSystem ? 'Now' : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setMessages(prev => [...prev, { id: Date.now() + Math.random(), type, text, time: timeString, senderName, isImage }]);
    };

    useEffect(() => {
        if (!hidden && !peer) {
            const permanentId = generatePermanentId();
            const newPeer = new Peer(permanentId);

            newPeer.on('open', (id) => {
                setMyPeerId(id);
            });

            newPeer.on('connection', (conn) => {
                switchToContact(conn.peer);
                addMessage('System: A peer connected securely.', 'received', true);
                setupConnection(conn);
            });

            newPeer.on('call', (call) => {
                // Someone is calling us
                setIncomingCalls(prev => [...prev, call]);
            });

            setPeer(newPeer);
        }
    }, [hidden, peer]);

    const setupConnection = (conn) => {
        setConnection(conn);
        conn.on('open', () => {
            switchToContact(conn.peer);
            addMessage('System: Connected to peer!', 'received', true);
        });
        conn.on('data', (data) => {
            try {
                const parsed = JSON.parse(data);
                addMessage(parsed.text, 'received', false, parsed.sender, parsed.isImage || false);
            } catch (e) {
                addMessage(data, 'received');
            }
        });
        conn.on('close', () => {
            setConnection(null);
            addMessage('System: Peer Disconnected.', 'received', true);
        });
        conn.on('error', (err) => {
            console.error(err);
        });
    };

    const setupCallEvents = (call) => {
        const targetId = call.peer;
        setActiveCalls(prev => ({ ...prev, [targetId]: call }));

        call.on('stream', (remoteStream) => {
            setRemoteStreams(prev => ({ ...prev, [targetId]: remoteStream }));
        });

        call.on('close', () => {
            endCallCleanup(targetId);
        });
    };

    const endCallCleanup = (targetId) => {
        setActiveCalls(prev => {
            const updated = { ...prev };
            delete updated[targetId];
            return updated;
        });
        setRemoteStreams(prev => {
            const updated = { ...prev };
            delete updated[targetId];
            return updated;
        });

        // If we don't have any more active calls, stop the mic
        setActiveCalls(latestCalls => {
            if (Object.keys(latestCalls).length === 0 && localStreamRef.current) {
                localStreamRef.current.getTracks().forEach(track => track.stop());
                localStreamRef.current = null;
            }
            return latestCalls; // unaffected state
        });

        addMessage(`System: Audio call ended with ${targetId}.`, 'received', true);
    };

    const getMicStream = () => {
        if (localStreamRef.current) {
            return Promise.resolve(localStreamRef.current);
        }
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            return Promise.reject(new Error("Microphone access is not supported on this device/browser. Please ensure you are using HTTPS."));
        }
        return navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
            localStreamRef.current = stream;
            return stream;
        });
    };

    const currentIncomingCall = incomingCalls[0];

    const acceptCall = () => {
        if (!currentIncomingCall) return;
        const callToAnswer = currentIncomingCall;

        getMicStream()
            .then((stream) => {
                callToAnswer.answer(stream);
                setupCallEvents(callToAnswer);
                setIncomingCalls(prev => prev.slice(1));
                switchToContact(callToAnswer.peer);
            })
            .catch((err) => {
                alert("Failed to get local audio: " + err);
                setIncomingCalls(prev => prev.slice(1));
            });
    };

    const declineCall = () => {
        if (!currentIncomingCall) return;
        currentIncomingCall.close();
        setIncomingCalls(prev => prev.slice(1));
    };

    const sendMessage = () => {
        if (!inputText.trim()) return;

        addMessage(inputText, 'sent', false, currentUser);

        if (connection && connection.open) {
            connection.send(JSON.stringify({ sender: currentUser, text: inputText, isImage: false }));
        } else {
            addMessage('System: Message not sent. You are not connected.', 'received', true);
        }
        setInputText('');
    };

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = reader.result;
            addMessage(base64String, 'sent', false, currentUser, true);
            if (connection && connection.open) {
                connection.send(JSON.stringify({ sender: currentUser, text: base64String, isImage: true }));
            } else {
                addMessage('System: Image not sent. You are not connected.', 'received', true);
            }
        };
        reader.readAsDataURL(file);
    };

    useEffect(() => {
        if (chatMessagesRef.current) {
            chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
        }
    }, [messages]);

    const handleConnect = () => {
        if (!peer || !myPeerId) {
            alert('Please wait for your Peer ID to generate.');
            return;
        }
        const targetId = prompt('Enter the Peer ID of the person you want to connect to:');
        if (targetId && targetId !== myPeerId) {
            switchToContact(targetId);
            const conn = peer.connect(targetId);
            setupConnection(conn);
        }
    };

    const handleShare = () => {
        if (myPeerId) {
            navigator.clipboard.writeText(myPeerId).then(() => {
                alert(`Your PERMANENT SECURE PEER ID: ${myPeerId} has been copied to your clipboard.`);
            }).catch(() => {
                prompt("Copy your PERMANENT SECURE PEER ID below:", myPeerId);
            });
        }
    };

    const handleCall = () => {
        if (!connection) {
            alert('You must connect to a peer via chat first before calling!');
            return;
        }

        const targetId = connection.peer;

        if (activeCalls[targetId]) {
            // End the call with THIS SPECIFIC peer
            activeCalls[targetId].close();
            endCallCleanup(targetId);
            return;
        }

        // Start a call with THIS SPECIFIC peer
        getMicStream()
            .then((stream) => {
                const call = peer.call(targetId, stream);
                setupCallEvents(call);
                addMessage(`System: Initiating audio call with ${targetId}...`, 'sent', true);
            })
            .catch((err) => {
                alert('Could not access microphone: ' + err);
            });
    };

    return (
        <div id="chat-view" className={`view ${hidden ? 'hidden' : 'active'}`}>
            {chatView === 'list' ? (
                <>
                    <header className="chat-header">
                        <div className="contact-info">
                            <div className="avatar">
                                <ion-icon name="chatbubbles"></ion-icon>
                            </div>
                            <div className="details">
                                <h2>Chats</h2>
                                <span className="status">
                                    {myPeerId ? `My ID: ${myPeerId}` : 'Connecting...'}
                                </span>
                            </div>
                        </div>
                        <div className="actions">
                            <button className="icon-btn" title="Share My ID" onClick={handleShare}>
                                <ion-icon name="copy-outline"></ion-icon>
                            </button>
                            <button className="icon-btn" title="Logout" onClick={onLogout}>
                                <ion-icon name="log-out-outline"></ion-icon>
                            </button>
                        </div>
                    </header>

                    <main className="contacts-list" style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
                        {Object.keys(allChats).length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#8b949e' }}>
                                <ion-icon name="chatbubbles-outline" style={{ fontSize: '3rem', marginBottom: '10px' }}></ion-icon>
                                <p>No secure chats yet.<br />Click the button below to start one.</p>
                            </div>
                        ) : (
                            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                {Object.keys(allChats).map(contactId => {
                                    const history = allChats[contactId];
                                    const lastMsg = history[history.length - 1];
                                    let preview = 'Say Hi!';
                                    if (lastMsg) {
                                        if (lastMsg.isImage) preview = '📷 Image';
                                        else if (lastMsg.text.startsWith('System:')) preview = lastMsg.text.substring(8);
                                        else preview = lastMsg.text;
                                    }

                                    return (
                                        <li key={contactId} className="contact-list-item" onClick={() => {
                                            switchToContact(contactId);
                                            if (peer && (!connection || connection.peer !== contactId)) {
                                                const conn = peer.connect(contactId);
                                                setupConnection(conn);
                                            }
                                        }}>
                                            <div className="avatar">
                                                <ion-icon name="person"></ion-icon>
                                            </div>
                                            <div style={{ flex: 1, overflow: 'hidden' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '4px' }}>
                                                    <h4 style={{ margin: 0, fontSize: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{contactId}</h4>
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{lastMsg ? lastMsg.time : ''}</span>
                                                </div>
                                                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {preview}
                                                </p>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </main>
                    <button className="fab-button" title="New Connection" onClick={handleConnect}>
                        <ion-icon name="chatbubble-ellipses"></ion-icon>
                    </button>
                </>
            ) : (
                <>
                    <header className="chat-header">
                        <div className="contact-info">
                            <button className="icon-btn back-btn" onClick={() => setChatView('list')}>
                                <ion-icon name="chevron-back-outline"></ion-icon>
                            </button>
                            <div className="avatar">
                                <ion-icon name="person"></ion-icon>
                            </div>
                            <div className="details">
                                <h2 style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }}>{activeContact}</h2>
                                <span className="status">
                                    {connection && connection.peer === activeContact ? 'Connected' : 'Offline / History'}
                                </span>
                                {Object.keys(activeCalls).length > 0 && (
                                    <div style={{ fontSize: '0.8rem', color: '#00ff88' }}>
                                        Active Calls: {Object.keys(activeCalls).length}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="actions">
                            <button
                                className="icon-btn"
                                title={connection && activeCalls[connection.peer] ? "End Call with current" : "Call current"}
                                onClick={handleCall}
                                style={connection && activeCalls[connection.peer] ? { color: '#f85149' } : {}}
                            >
                                <ion-icon name={isCallingAny ? "call" : "call-outline"}></ion-icon>
                            </button>
                        </div>
                    </header>

                    {currentIncomingCall && (
                        <div className="call-overlay">
                            <div className="call-overlay-content">
                                <p>Incoming Audio Call from {currentIncomingCall.peer}...</p>
                                <div className="call-actions">
                                    <button className="accept-btn" onClick={acceptCall}>
                                        <ion-icon name="call"></ion-icon> Accept
                                    </button>
                                    <button className="decline-btn" onClick={declineCall}>
                                        <ion-icon name="close-circle"></ion-icon> Decline
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    <main className="chat-messages" ref={chatMessagesRef}>
                        {messages.map(msg => (
                            <div key={msg.id} className={`message ${msg.type}`} style={msg.text.startsWith('System:') ? { background: 'rgba(255, 0, 0, 0.1)' } : {}}>
                                {msg.senderName && !msg.text.startsWith('System:') && (
                                    <div className="message-sender">{msg.type === 'sent' ? 'You' : msg.senderName}</div>
                                )}
                                {msg.isImage ? (
                                    <img src={msg.text} alt="Shared" style={{ maxWidth: '100%', borderRadius: '10px', marginTop: '5px' }} />
                                ) : (
                                    <p>{msg.text}</p>
                                )}
                                <span className="time">{msg.time}</span>
                            </div>
                        ))}

                        {/* Render all remote streams from the group call */}
                        {Object.keys(remoteStreams).map(peerId => (
                            <AudioStreamPlayer key={peerId} stream={remoteStreams[peerId]} />
                        ))}
                    </main>

                    <footer className="chat-input-area">
                        <button className="icon-btn" onClick={() => document.getElementById('image-upload').click()}>
                            <ion-icon name="add-outline"></ion-icon>
                        </button>
                        <input
                            type="file"
                            id="image-upload"
                            accept="image/*"
                            style={{ display: 'none' }}
                            onChange={handleImageUpload}
                            onClick={(e) => { e.target.value = null }}
                        />
                        <input
                            type="text"
                            placeholder="Message..."
                            autoComplete="off"
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            onKeyPress={(e) => { if (e.key === 'Enter') sendMessage() }}
                        />
                        <button className="icon-btn send-btn" onClick={sendMessage}>
                            <ion-icon name="send"></ion-icon>
                        </button>
                    </footer>
                </>
            )}
        </div>
    );
}

export default Chat;
