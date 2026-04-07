import { useState, useEffect, useRef } from 'react';
import Peer from 'peerjs';

const generatePermanentId = (username) => {
    const key = `myPermanentPeerId_${username}`;
    let id = localStorage.getItem(key);
    if (!id) {
        id = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
        localStorage.setItem(key, id);
    }
    return id;
};

// Sub-component to render multiple media streams (audio/video)
function MediaStreamPlayer({ stream, muted, isRemote }) {
    const videoRef = useRef(null);
    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
        }
    }, [stream]);
    return <video ref={videoRef} autoPlay playsInline muted={muted} className={isRemote ? 'remote-video' : 'local-video'} />;
}

function Chat({ hidden, currentUser, onLogout }) {
    const [peer, setPeer] = useState(null);
    const [myPeerId, setMyPeerId] = useState('');
    const [connection, setConnection] = useState(null);
    const [activeContact, setActiveContact] = useState(null);
    const [chatView, setChatView] = useState('list');
    const [contextMenu, setContextMenu] = useState(null); // { contactId, x, y }
    const longPressTimerRef = useRef(null);

    const [isMicMuted, setIsMicMuted] = useState(false);
    const [isSpeakerDisabled, setIsSpeakerDisabled] = useState(false);
    const [allChats, setAllChats] = useState(() => {
        const saved = localStorage.getItem(`secureChatsData_${currentUser}`);
        if (saved) {
            try { return JSON.parse(saved); } catch (e) { console.error("Parse error", e); }
        }
        return {};
    });

    const [messages, setMessages] = useState([{
        id: 1, type: 'received', text: 'Welcome to the secure channel. Connect to a peer to start messaging.', time: 'Now'
    }]);

    const [inputText, setInputText] = useState('');

    // Audio/Video Call States
    const [activeCalls, setActiveCalls] = useState({}); // { [peerId]: callObj }
    const [incomingCalls, setIncomingCalls] = useState([]); // array of call objs ringing
    const [remoteStreams, setRemoteStreams] = useState({}); // { [peerId]: MediaStream }
    const [localStream, setLocalStream] = useState(null);
    const [isVideoCall, setIsVideoCall] = useState(false);
    const [isVideoMuted, setIsVideoMuted] = useState(false);

    const localStreamRef = useRef(null);
    const chatMessagesRef = useRef(null);
    const isCallingAny = Object.keys(activeCalls).length > 0;

    // When user changes, reload their chat data
    useEffect(() => {
        if (currentUser) {
            const saved = localStorage.getItem(`secureChatsData_${currentUser}`);
            if (saved) {
                try {
                    setAllChats(JSON.parse(saved));
                } catch (e) {
                    console.error("Parse error", e);
                    setAllChats({});
                }
            } else {
                setAllChats({});
            }
            setActiveContact(null);
            setChatView('list');
            setMessages([{
                id: 1, type: 'received', text: 'Welcome to the secure channel. Connect to a peer to start messaging.', time: 'Now'
            }]);
        }
    }, [currentUser]);

    useEffect(() => {
        if (activeContact && currentUser) {
            setAllChats(prev => {
                const updated = { ...prev, [activeContact]: messages };
                localStorage.setItem(`secureChatsData_${currentUser}`, JSON.stringify(updated));
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

    const handleDeleteChat = (contactId) => {
        setAllChats(prev => {
            const updated = { ...prev };
            delete updated[contactId];
            localStorage.setItem(`secureChatsData_${currentUser}`, JSON.stringify(updated));
            return updated;
        });
        if (activeContact === contactId) {
            setActiveContact(null);
            setMessages([]);
            setChatView('list');
        }
        if (connection && connection.peer === contactId) {
            connection.close();
            setConnection(null);
        }
        setContextMenu(null);
    };

    const handleLongPressStart = (e, contactId) => {
        const touch = e.touches ? e.touches[0] : e;
        const rect = e.currentTarget.closest('.contacts-list')?.getBoundingClientRect() || { left: 0, top: 0 };
        longPressTimerRef.current = setTimeout(() => {
            e.preventDefault?.();
            setContextMenu({
                contactId,
                x: touch.clientX - rect.left,
                y: touch.clientY - rect.top
            });
        }, 500);
    };

    const handleLongPressEnd = () => {
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
    };

    const handleContextMenu = (e, contactId) => {
        e.preventDefault();
        const rect = e.currentTarget.closest('.contacts-list')?.getBoundingClientRect() || { left: 0, top: 0 };
        setContextMenu({
            contactId,
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        });
    };

    const addMessage = (text, type = 'received', isSystem = false, senderName = null, isImage = false) => {
        const timeString = isSystem ? 'Now' : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setMessages(prev => [...prev, { id: Date.now() + Math.random(), type, text, time: timeString, senderName, isImage }]);
    };

    // Clean up peer when user logs out (hidden becomes true)
    useEffect(() => {
        if (hidden && peer) {
            peer.destroy();
            setPeer(null);
            setMyPeerId('');
            setConnection(null);
            setActiveCalls({});
            setIncomingCalls([]);
            setRemoteStreams({});
            setLocalStream(null);
            setIsVideoCall(false);
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach(track => track.stop());
                localStreamRef.current = null;
            }
        }
    }, [hidden]);

    useEffect(() => {
        if (!hidden && !peer && currentUser) {
            const permanentId = generatePermanentId(currentUser);
            const newPeer = new Peer(permanentId, {
                config: {
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' },
                        { urls: 'stun:stun2.l.google.com:19302' },
                        { urls: 'stun:stun3.l.google.com:19302' },
                        { urls: 'stun:stun4.l.google.com:19302' },
                    ]
                }
            });

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
    }, [hidden, peer, currentUser]);

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

        // If we don't have any more active calls, stop the hardware tracks
        setActiveCalls(latestCalls => {
            if (Object.keys(latestCalls).length === 0 && localStreamRef.current) {
                localStreamRef.current.getTracks().forEach(track => track.stop());
                localStreamRef.current = null;
                setLocalStream(null);
                setIsVideoCall(false);
            }
            return latestCalls; // unaffected state
        });

        addMessage(`System: Call ended with ${targetId}.`, 'received', true);
    };

    const getMediaStream = (videoMode = false) => {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            return Promise.reject(new Error("Media access is not supported on this device/browser."));
        }
        return navigator.mediaDevices.getUserMedia({ audio: true, video: videoMode }).then(stream => {
            localStreamRef.current = stream;
            setLocalStream(stream);
            setIsVideoCall(videoMode);
            const audioTrack = stream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !isMicMuted;
            }
            const videoTrack = stream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !isVideoMuted;
            }
            return stream;
        });
    };

    useEffect(() => {
        if (localStreamRef.current) {
            const audioTrack = localStreamRef.current.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !isMicMuted;
            }
            const videoTrack = localStreamRef.current.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !isVideoMuted;
            }
        }
    }, [isMicMuted, isVideoMuted]);

    const currentIncomingCall = incomingCalls[0];

    const acceptCall = () => {
        if (!currentIncomingCall) return;
        const callToAnswer = currentIncomingCall;
        const wantsVideo = callToAnswer.metadata?.isVideo === true;

        getMediaStream(wantsVideo)
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

    const handleCall = (videoMode = false) => {
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
        getMediaStream(videoMode)
            .then((stream) => {
                const call = peer.call(targetId, stream, { metadata: { isVideo: videoMode } });
                setupCallEvents(call);
                addMessage(`System: Initiating ${videoMode ? 'video' : 'audio'} call with ${targetId}...`, 'sent', true);
            })
            .catch((err) => {
                alert('Could not access media devices: ' + err);
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

                    <main className="contacts-list" style={{ flex: 1, overflowY: 'auto', padding: '10px', position: 'relative' }} onClick={() => contextMenu && setContextMenu(null)}>
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
                                        <li key={contactId} className="contact-list-item"
                                            onClick={() => {
                                                if (contextMenu) return;
                                                switchToContact(contactId);
                                                if (peer && (!connection || connection.peer !== contactId)) {
                                                    const conn = peer.connect(contactId);
                                                    setupConnection(conn);
                                                }
                                            }}
                                            onContextMenu={(e) => handleContextMenu(e, contactId)}
                                            onTouchStart={(e) => handleLongPressStart(e, contactId)}
                                            onTouchEnd={handleLongPressEnd}
                                            onTouchMove={handleLongPressEnd}
                                            onMouseDown={(e) => { if (e.button === 0) handleLongPressStart(e, contactId); }}
                                            onMouseUp={handleLongPressEnd}
                                            onMouseLeave={handleLongPressEnd}
                                        >
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

                        {/* Context Menu Popup */}
                        {contextMenu && (
                            <div className="chat-context-menu" style={{ top: contextMenu.y, left: contextMenu.x }}>
                                <button className="context-menu-item delete" onClick={() => handleDeleteChat(contextMenu.contactId)}>
                                    <ion-icon name="trash-outline"></ion-icon>
                                    Delete Chat
                                </button>
                                <button className="context-menu-item cancel" onClick={() => setContextMenu(null)}>
                                    <ion-icon name="close-outline"></ion-icon>
                                    Cancel
                                </button>
                            </div>
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
                            {!isCallingAny && (
                                <div className="call-init-pill">
                                    <button className="icon-btn" title="Video Call" onClick={() => handleCall(true)}>
                                        <ion-icon name="videocam-outline"></ion-icon>
                                    </button>
                                    <button className="icon-btn" title="Voice Call" onClick={() => handleCall(false)}>
                                        <ion-icon name="call-outline"></ion-icon>
                                    </button>
                                </div>
                            )}
                        </div>
                    </header>

                    {currentIncomingCall && (
                        <div className="call-overlay">
                            <div className="call-overlay-content">
                                <p>Incoming {currentIncomingCall.metadata?.isVideo ? 'Video' : 'Audio'} Call from {currentIncomingCall.peer}...</p>
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

                        {/* Render all remote streams from the group call in Audio-Only mode */}
                        {!isVideoCall && Object.keys(remoteStreams).map(peerId => (
                            <MediaStreamPlayer key={peerId} stream={remoteStreams[peerId]} muted={isSpeakerDisabled} isRemote={true} />
                        ))}

                        {/* Video Call Active Interface */}
                        {isVideoCall && isCallingAny && (
                            <div className="video-overlay-active">
                                {Object.keys(remoteStreams).map(peerId => (
                                    <MediaStreamPlayer key={peerId} stream={remoteStreams[peerId]} muted={isSpeakerDisabled} isRemote={true} />
                                ))}
                                {localStream && (
                                    <div className="local-video-pip">
                                        <MediaStreamPlayer stream={localStream} muted={true} isRemote={false} />
                                    </div>
                                )}
                            </div>
                        )}
                    </main>

                    <footer className="chat-input-area">
                        <div className="input-wrapper">
                            <input
                                type="text"
                                placeholder="Message"
                                autoComplete="off"
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                onKeyPress={(e) => { if (e.key === 'Enter') sendMessage() }}
                            />
                            <button className="icon-btn attach-btn" onClick={() => document.getElementById('image-upload').click()}>
                                <ion-icon name="attach-outline" style={{ transform: 'rotate(45deg)' }}></ion-icon>
                            </button>
                            <input
                                type="file"
                                id="image-upload"
                                accept="image/*"
                                style={{ display: 'none' }}
                                onChange={handleImageUpload}
                                onClick={(e) => { e.target.value = null }}
                            />
                        </div>
                        <button className="send-btn" onClick={sendMessage}>
                            <ion-icon name="send"></ion-icon>
                        </button>
                    </footer>

                    {/* Active Call Controls Bar */}
                    {isCallingAny && (
                        <div className="call-controls-bar">
                            {isVideoCall && (
                                <button className={`control-btn ${isVideoMuted ? 'muted' : ''}`} onClick={() => setIsVideoMuted(!isVideoMuted)}>
                                    <ion-icon name={isVideoMuted ? "videocam-off" : "videocam"}></ion-icon>
                                </button>
                            )}
                            <button className={`control-btn ${isSpeakerDisabled ? 'muted' : ''}`} onClick={() => setIsSpeakerDisabled(!isSpeakerDisabled)}>
                                <ion-icon name={isSpeakerDisabled ? "volume-mute" : "volume-high"}></ion-icon>
                            </button>
                            <button className={`control-btn ${isMicMuted ? 'muted' : ''}`} onClick={() => setIsMicMuted(!isMicMuted)}>
                                <ion-icon name={isMicMuted ? "mic-off" : "mic"}></ion-icon>
                            </button>
                            <button className="control-btn end-call" onClick={() => handleCall(isVideoCall)}>
                                <ion-icon name="call" style={{ transform: 'rotate(135deg)' }}></ion-icon>
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

export default Chat;
