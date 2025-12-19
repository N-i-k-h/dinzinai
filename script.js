document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('aiForm');
    const submitBtn = document.getElementById('submitBtn');
    const inputField = document.getElementById('inputText');
    const chatContainer = document.getElementById('chatContainer');
    const emptyState = document.querySelector('.empty-state');
    const errorMessage = document.getElementById('errorMessage');
    const errorText = document.getElementById('errorText');

    // Chat History Management
    let currentChatId = null;
    let currentChatMessages = [];

    // Mode & Agent Logic
    let currentMode = 'generic_chat';
    let currentAgent = 'nex-agi/deepseek-v3.1-nex-n1:free';

    const modeSelect = document.getElementById('modeSelect');
    const agentSelect = document.getElementById('agentSelect');

    if (modeSelect) {
        modeSelect.addEventListener('change', (e) => {
            currentMode = e.target.value;
            // Keep custom dropdown label in sync if present
            const dd = document.querySelector('.custom-dropdown[data-target-select="modeSelect"]');
            if (dd) {
                const label = dd.querySelector('.custom-dropdown-label');
                if (label) {
                    const opt = modeSelect.options[modeSelect.selectedIndex];
                    label.textContent = opt ? opt.textContent : '';
                }
                dd.querySelectorAll('.custom-dropdown-option').forEach(optEl => {
                    optEl.classList.toggle('selected', optEl.getAttribute('data-value') === e.target.value);
                });
            }
        });
    }

    if (agentSelect) {
        agentSelect.addEventListener('change', (e) => {
            currentAgent = e.target.value;
            // Keep custom dropdown label in sync if present
            const dd = document.querySelector('.custom-dropdown[data-target-select="agentSelect"]');
            if (dd) {
                const label = dd.querySelector('.custom-dropdown-label');
                if (label) {
                    const opt = agentSelect.options[agentSelect.selectedIndex];
                    label.textContent = opt ? opt.textContent : '';
                }
                dd.querySelectorAll('.custom-dropdown-option').forEach(optEl => {
                    optEl.classList.toggle('selected', optEl.getAttribute('data-value') === e.target.value);
                });
            }
        });
    }

    // Build custom mobile drop-UP dropdowns from native selects
    function setupCustomDropdown(selectId) {
        const select = document.getElementById(selectId);
        const dropdown = document.querySelector(`.custom-dropdown[data-target-select="${selectId}"]`);
        if (!select || !dropdown) return;

        const menu = dropdown.querySelector('.custom-dropdown-menu');
        const labelEl = dropdown.querySelector('.custom-dropdown-label');

        // Populate options
        menu.innerHTML = '';
        Array.from(select.options).forEach(opt => {
            const optEl = document.createElement('div');
            optEl.className = 'custom-dropdown-option';
            optEl.textContent = opt.textContent;
            optEl.setAttribute('data-value', opt.value);
            if (opt.selected) {
                optEl.classList.add('selected');
                if (labelEl) labelEl.textContent = opt.textContent;
            }
            optEl.addEventListener('click', () => {
                select.value = opt.value;
                select.dispatchEvent(new Event('change'));
                dropdown.classList.remove('open');
            });
            menu.appendChild(optEl);
        });

        // Toggle open/close
        const toggleBtn = dropdown.querySelector('.custom-dropdown-toggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const isOpen = dropdown.classList.contains('open');
                document.querySelectorAll('.custom-dropdown.open').forEach(dd => dd.classList.remove('open'));
                if (!isOpen) {
                    dropdown.classList.add('open');
                }
            });
        }
    }

    setupCustomDropdown('agentSelect');
    setupCustomDropdown('modeSelect');

    // Close custom dropdowns when clicking outside
    document.addEventListener('click', () => {
        document.querySelectorAll('.custom-dropdown.open').forEach(dd => dd.classList.remove('open'));
    });

    // Sidebar & New Chat Logic
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    const authBtn = document.getElementById('authBtn');
    const authText = document.getElementById('authText');
    const authAvatar = document.getElementById('authAvatar');
    const newChatBtn = document.getElementById('newChatBtn');
    const historyList = document.getElementById('historyList');

    // Login Modal Elements
    const loginModal = document.getElementById('loginModal');
    const googleLoginBtn = document.getElementById('googleLoginBtn');
    const closeLoginModal = document.getElementById('closeLoginModal');
    const loginError = document.getElementById('loginError');

    // Chat History Functions
    // Chat History Functions
    async function getChatHistoryFromServer() {
        const savedUser = localStorage.getItem('dinzinUser');
        if (!savedUser) return [];

        try {
            const user = JSON.parse(savedUser);
            // Use sub ID from Google as unique user ID, or email
            const userId = user.sub || user.email;

            const response = await fetch('/api/get-history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId })
            });
            const data = await response.json();
            if (data.success) {
                return data.history;
            }
        } catch (e) {
            console.error("Error fetching history:", e);
        }
        return [];
    }

    // Load full chat details (messages) -> For now we only store summary in history list, 
    // but typically we'd fetch the full chat from DB by ID. 
    // However, to keep it simple, we might need another endpoint 'get-chat' or 
    // we can assume the history list *is* just metadata and we need to fetch messages when clicked.
    // For now, let's just make sure the LIST works. We'll need a way to load messages.
    // Actually our previous SaveChat implementation sends the whole object including messages.
    // So 'get-history' only returns summaries. We need 'get-chat-details' or similar?
    // Let's modify loadChat to fetch from server if possible, or we can just fetch all history (heavy).
    // Better: let's stick to the plan. Fetching history list is good. 
    // BUT we need to load the messages when clicked. 

    // Let's rely on LocalStorage for *immediate* message caching but Server for persistence.
    // OR, better, let's implement a 'loadChat' that fetches from server if not found locally.

    // Wait, simpler approach for this turn:
    // Just sync the history LIST from server.

    async function renderChatHistory() {
        if (!historyList) return;

        let history = [];
        const isLoggedIn = localStorage.getItem('dinzin_is_logged_in') === 'true';

        if (isLoggedIn) {
            history = await getChatHistoryFromServer();
        }

        if (history.length === 0) {
            historyList.innerHTML = '<li class="history-empty">No previous chats</li>';
            return;
        }

        historyList.innerHTML = history.map(chat => {
            const date = new Date(chat.timestamp);
            const timeAgo = getTimeAgo(date);
            return `
                <li class="history-item" data-chat-id="${chat.id}">
                    <div class="history-item-content">
                        <span class="history-title">${escapeHtml(chat.title)}</span>
                        <span class="history-time">${timeAgo}</span>
                    </div>
                </li>
            `;
        }).join('');

        // Add click handlers
        historyList.querySelectorAll('.history-item').forEach(item => {
            item.addEventListener('click', () => {
                const chatId = item.getAttribute('data-chat-id');
                // For now, if we don't have messages, we can't load it purely from summary.
                // We need to fetch full chat.
                // Let's create a quick helper to fetch full chat or use local backup.
                loadChat(chatId);
            });
        });
    }

    async function saveCurrentChat() {
        if (!currentChatId || currentChatMessages.length === 0) return;

        const savedUser = localStorage.getItem('dinzinUser');
        if (!savedUser) return; // Only save if logged in

        const user = JSON.parse(savedUser);
        const userId = user.sub || user.email;

        const chatData = {
            id: currentChatId,
            userId: userId, // Link to user
            title: getChatTitle(),
            messages: currentChatMessages,
            timestamp: Date.now()
        };

        // Send to Backend
        fetch('/api/save-chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(chatData)
        }).catch(e => console.error("Error saving chat:", e));

        // Refresh list potentially? Or just leave it for next reload/render
        // Ideally we update the UI list too without fetching again
        renderChatHistory(); // This will fetch invalidly often. Maybe optimize later.
    }

    function getTimeAgo(date) {
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        return date.toLocaleDateString();
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function getChatTitle() {
        if (currentChatMessages.length === 0) return 'New Chat';
        const firstUserMessage = currentChatMessages.find(msg => msg.role === 'user');
        if (firstUserMessage) {
            const title = firstUserMessage.content.substring(0, 50);
            return title.length < firstUserMessage.content.length ? title + '...' : title;
        }
        return 'New Chat';
    }

    async function loadChat(chatId) {
        // Fetch full chat from server
        const savedUser = localStorage.getItem('dinzinUser');
        if (!savedUser) return;
        const user = JSON.parse(savedUser);
        const userId = user.sub || user.email;

        try {
            const response = await fetch('/api/get-chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chatId, userId })
            });

            const data = await response.json();
            if (!data.success || !data.chat) {
                console.error("Chat not found or error loading");
                return;
            }

            const chat = data.chat;
            currentChatId = chatId;
            currentChatMessages = chat.messages || [];

            // Clear and render messages
            chatContainer.innerHTML = '';
            const mainInterface = document.getElementById('mainInterface');
            if (mainInterface) mainInterface.classList.remove('intro-view');
            if (emptyState) emptyState.style.display = 'none';

            // Render existing messages
            currentChatMessages.forEach(msg => {
                appendMessage(msg.content, msg.role === 'user' ? 'user' : 'ai', false);
            });

            // Update active history item
            if (historyList) {
                historyList.querySelectorAll('.history-item').forEach(item => {
                    item.classList.remove('active');
                    if (item.getAttribute('data-chat-id') === chatId) {
                        item.classList.add('active');
                    }
                });
            }

            if (window.innerWidth < 900 && sidebar.classList.contains('open')) {
                sidebar.classList.remove('open');
                document.body.classList.remove('sidebar-open');
            }
        } catch (e) {
            console.error("Error loading chat:", e);
        }
    }

    function startNewChat() {
        saveCurrentChat();
        currentChatId = `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        currentChatMessages = [];
        chatContainer.innerHTML = `
            <div class="empty-state">
                <h1 class="fade-in-text">Hi, I'm Dinzin AI, here to help you.</h1>
            </div>
        `;
        const mainInterface = document.getElementById('mainInterface');
        if (mainInterface) mainInterface.classList.add('intro-view');
        if (inputField) inputField.style.height = 'auto';

        // Remove active class from all history items
        historyList.querySelectorAll('.history-item').forEach(item => {
            item.classList.remove('active');
        });

        if (window.innerWidth < 768 && sidebar.classList.contains('open')) {
            sidebar.classList.remove('open');
            document.body.classList.remove('sidebar-open');
        }
    }

    // New Chat Button
    if (newChatBtn) {
        newChatBtn.addEventListener('click', startNewChat);
    }

    // Sidebar Toggle
    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('open');
            document.body.classList.toggle('sidebar-open');
        });
        document.addEventListener('click', (e) => {
            if (sidebar.classList.contains('open') && !sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
                sidebar.classList.remove('open');
                document.body.classList.remove('sidebar-open');
            }
        });
    }

    // Login Modal Functions
    function showLoginModal() {
        if (loginModal) {
            loginModal.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        }
    }

    function hideLoginModal() {
        if (loginModal) {
            loginModal.classList.add('hidden');
            document.body.style.overflow = '';
            document.body.style.overflow = '';
            // No form to reset
            loginError.classList.add('hidden');
        }
    }

    if (closeLoginModal) {
        closeLoginModal.addEventListener('click', hideLoginModal);
    }

    if (loginModal) {
        loginModal.addEventListener('click', (e) => {
            if (e.target === loginModal) {
                // Allow closing by clicking outside? usually yes, but for popup on load maybe keep it focused?
                // User said "dont make login compulsary", so yes, allow closing.
                hideLoginModal();
            }
        });
    }

    // Login Form Handler
    // Google Login Handler
    if (googleLoginBtn) {
        googleLoginBtn.addEventListener('click', () => {
            // Simulate Google Login
            const googlePopup = window.open('about:blank', 'google_login', 'width=500,height=600');
            if (googlePopup) {
                googlePopup.document.write('<h1>Simulating Google Login...</h1><p>Closing in 2 seconds...</p>');
                setTimeout(() => {
                    googlePopup.close();

                    // Proceed with login logic
                    const userId = `user_google_${Date.now()}`;
                    const username = "Google User";
                    const userInitials = "GU";

                    localStorage.setItem('dinzin_is_logged_in', 'true');
                    localStorage.setItem('dinzin_user_id', userId);
                    localStorage.setItem('dinzin_username', username);
                    localStorage.setItem('dinzin_user_initials', userInitials);

                    updateAuthUI();
                    hideLoginModal();
                    renderChatHistory();

                    // Show success message or toast if needed
                    console.log('Logged in with Google');
                }, 1500);
            } else {
                // Fallback if popup blocked
                const userId = `user_google_${Date.now()}`;
                const username = "Google User";
                const userInitials = "GU";

                localStorage.setItem('dinzin_is_logged_in', 'true');
                localStorage.setItem('dinzin_user_id', userId);
                localStorage.setItem('dinzin_username', username);
                localStorage.setItem('dinzin_user_initials', userInitials);

                updateAuthUI();
                hideLoginModal();
                renderChatHistory();
            }
        });
    }

    function getInitials(name) {
        const parts = name.trim().split(' ');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    }

    // Auth UI Update
    function updateAuthUI() {
        if (authBtn && authText && authAvatar) {
            const isLoggedIn = localStorage.getItem('dinzin_is_logged_in') === 'true';
            if (isLoggedIn) {
                const username = localStorage.getItem('dinzin_username') || 'User';
                const initials = localStorage.getItem('dinzin_user_initials') || 'U';
                authText.textContent = username;
                authAvatar.innerHTML = initials;
                authAvatar.classList.add('has-initials');
                authBtn.classList.add('logged-in');
            } else {
                authText.textContent = 'Login';
                authAvatar.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;
                authAvatar.classList.remove('has-initials');
                authBtn.classList.remove('logged-in');
            }
        }
    }

    // Auth Button Click Handler
    if (authBtn) {
        authBtn.addEventListener('click', () => {
            const isLoggedIn = localStorage.getItem('dinzin_is_logged_in') === 'true';
            if (isLoggedIn) {
                // Show logout option (could be a dropdown menu)
                if (confirm('Do you want to logout?')) {
                    localStorage.setItem('dinzin_is_logged_in', 'false');
                    localStorage.removeItem('dinzin_user_id');
                    localStorage.removeItem('dinzin_username');
                    localStorage.removeItem('dinzin_user_initials');
                    // Clear chat history for this session
                    currentChatId = null;
                    currentChatMessages = [];
                    updateAuthUI();
                    renderChatHistory();
                    startNewChat();
                }
            } else {
                showLoginModal();
            }
        });
        updateAuthUI();
    }

    // Auto-resize Textarea & Submit
    if (inputField) {
        inputField.addEventListener('input', function () {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 150) + 'px';
            if (submitBtn) submitBtn.disabled = this.value.trim().length === 0;
        });

        inputField.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!submitBtn.disabled) form.dispatchEvent(new Event('submit'));
            }
        });
    }

    // Chat Submission
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const text = inputField.value.trim();
            if (!text) return;

            // User can chat without login (Guest Mode)
            // const isLoggedIn = localStorage.getItem('dinzin_is_logged_in') === 'true';

            // Start new chat if needed
            if (!currentChatId) {
                currentChatId = `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                currentChatMessages = [];
            }

            // Remove Intro View
            const mainInterface = document.getElementById('mainInterface');
            if (mainInterface) mainInterface.classList.remove('intro-view');

            // UI Updates
            if (emptyState) emptyState.style.display = 'none';
            if (errorMessage) errorMessage.classList.add('hidden');

            appendMessage(text, 'user');
            currentChatMessages.push({ role: 'user', content: text });

            inputField.value = '';
            inputField.style.height = 'auto';
            submitBtn.disabled = true;

            const aiMsgId = appendMessage('Thinking...', 'ai', true);

            try {
                const response = await fetch('api.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        text: text,
                        action: currentMode,
                        agent: currentAgent
                    })
                });
                const responseText = await response.text();

                if (responseText.trim().startsWith('<?php') || responseText.includes('header(\'Content-Type: application/json\')')) {
                    console.warn('Backend not running (raw PHP detected).');
                    await simulateLocalResponse(text, aiMsgId, "raw_php");
                    return;
                }

                let result;
                try {
                    result = JSON.parse(responseText);
                } catch (err) {
                    console.error('Raw response:', responseText);
                    await simulateLocalResponse(text, aiMsgId);
                    return;
                }

                if (!result.success) {
                    // Server returned a specific error (e.g. API Error) -> Show it, don't fallback to demo
                    console.error('Server reported error:', result.message);
                    updateMessage(aiMsgId, `Error: ${result.message}`, true);
                    return;
                }

                updateMessage(aiMsgId, result.data);
                currentChatMessages.push({ role: 'assistant', content: result.data });
                saveCurrentChat();

            } catch (err) {
                console.warn('Network/Parsing Error. Switching to Demo Mode.', err);
                // Only fallback if it's a network/parsing error, not a logical API error
                await simulateLocalResponse(text, aiMsgId);
            }
        });
    }

    async function simulateLocalResponse(text, msgId, errorType = null) {
        await new Promise(r => setTimeout(r, 1500));

        let responseContent = "";

        if (errorType === 'raw_php') {
            responseContent = `<strong>System Alert:</strong><br>I see you are trying to use the real AI, but I detected **Raw PHP code**. <br><br>
            This usually means you opened the file directly (e.g., <code>file:///...</code>).<br>
            Please make sure the server is running (<code>start_server.bat</code>) and open: <br>
            <a href="http://localhost:8000" target="_blank" style="color: #4da6ff; text-decoration: underline;">http://localhost:8000</a>`;
        } else if (currentMode === 'bullet_points') {
            responseContent = `Here are the key points about "${text}":<br>
            • Point one regarding your query.<br>
            • Another important detail.<br>
            • A third perspective for consideration.<br>
            • Final summary point.`;
        } else if (currentMode === 'summarize') {
            responseContent = `<strong>Summary:</strong><br>You asked about "${text}". In short, this topic covers effectively handling user queries in a simulated environment.`;
        } else if (currentMode === 'draft_reply') {
            responseContent = `Here is a draft reply you can use:<br><br>"Hi there, thanks for reaching out about '${text}'. I'd be happy to help you with that..."`;
        } else {
            // Generic Chat
            const responses = [
                `I am operating in Client-Side Demo Mode (Server not required!). I heard you say: "${text}"`,
                "This is a simulated response because the backend server is not running. You can still chat with me!",
                "I can help you with web design, coding, and more. (Demo Response)"
            ];
            responseContent = responses[Math.floor(Math.random() * responses.length)];
        }

        updateMessage(msgId, responseContent);
        currentChatMessages.push({ role: 'assistant', content: responseContent });
        saveCurrentChat();
    }

    function appendMessage(content, sender, isLoading = false) {
        const div = document.createElement('div');
        div.className = `message-bubble message-${sender}`;
        div.id = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        if (isLoading) {
            div.innerHTML = `<span class="loader-dots">Thinking</span>`;
        } else {
            div.textContent = content;
        }

        chatContainer.appendChild(div);
        chatContainer.scrollTo({ top: chatContainer.scrollHeight, behavior: 'smooth' });
        return div.id;
    }

    function updateMessage(id, content, isError = false, isRawError = false) {
        const el = document.getElementById(id);
        if (el) {
            el.innerHTML = '';
            if (isError) {
                el.style.color = '#ff6b6b';
                el.textContent = content;
            } else {
                el.textContent = content;
            }
            chatContainer.scrollTo({ top: chatContainer.scrollHeight, behavior: 'smooth' });
        }
    }

    // Initialize
    const isLoggedIn = localStorage.getItem('dinzin_is_logged_in') === 'true';
    if (isLoggedIn) {
        renderChatHistory();
    } else {
        if (historyList) {
            historyList.innerHTML = '<li class="history-empty">Login to see your chat history</li>';
        }
        // Show login popup on load
        setTimeout(() => {
            showLoginModal();
        }, 1000); // Small delay for better UX
    }

    // Show/hide menu toggle based on screen size
    function updateMenuToggle() {
        if (menuToggle) {
            if (window.innerWidth < 900) {
                menuToggle.style.display = 'flex';
            } else {
                menuToggle.style.display = 'none';
            }
        }
    }

    updateMenuToggle();
    window.addEventListener('resize', updateMenuToggle);

    // Save chat before page unload
    window.addEventListener('beforeunload', () => {
        saveCurrentChat();
    });
});

// --- Google Login Logic ---

function handleCredentialResponse(response) {
    if (response.credential) {
        try {
            const responsePayload = decodeJwtResponse(response.credential);

            console.log("Logged in as: " + responsePayload.name);

            // Update UI
            updateUserUI(responsePayload);

            // Save to LocalStorage
            localStorage.setItem('dinzinUser', JSON.stringify(responsePayload));
            localStorage.setItem('dinzin_is_logged_in', 'true');

            // Send to Backend (MongoDB)
            fetch('/api/save-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(responsePayload)
            }).then(res => res.json())
                .then(data => console.log("User saved to DB:", data))
                .catch(err => console.error("Error saving user:", err));

            // Close Modal
            const modal = document.getElementById('loginModal');
            if (modal) modal.classList.add('hidden');

            // Reload page to reflect state (optional, or just update UI)
            // location.reload(); 

        } catch (e) {
            console.error("Error decoding Google token", e);
        }
    }
}

// Global scope
window.handleCredentialResponse = handleCredentialResponse;

function decodeJwtResponse(token) {
    var base64Url = token.split('.')[1];
    var base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    var jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function (c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    return JSON.parse(jsonPayload);
}

function updateUserUI(user) {
    const authText = document.getElementById('authText');
    const authAvatar = document.getElementById('authAvatar');

    if (authText) authText.textContent = user.given_name || user.name;

    if (authAvatar && user.picture) {
        authAvatar.innerHTML = `<img src="${user.picture}" alt="${user.name}" style="width: 100%; height: 100%; border-radius: 50%;">`;
    }
}

// Check on load (outside the main event listener to run immediately if needed, or re-run)
document.addEventListener('DOMContentLoaded', () => {
    const savedUser = localStorage.getItem('dinzinUser');
    if (savedUser) {
        try {
            updateUserUI(JSON.parse(savedUser));
        } catch (e) {
            console.error(e);
        }
    }
});
