// Chat System
let unreadMessages = { public: 0, private: {} };
let currentChatTab = 'public';
let isChatOpen = false;
let privateChatWindows = {};

// Initialize chat
function initChat() {
  setupChatNotifications();
  updateChatBadge();
  
  // Set online status
  if (currentEmployeeId) {
    db.ref(`users/${currentEmployeeId}/online`).set(true);
    db.ref(`users/${currentEmployeeId}/online`).onDisconnect().set(false);
  }
}

// Toggle chat window
function toggleChat() {
  isChatOpen = !isChatOpen;
  const chatContainer = document.getElementById('chat-container');
  
  if (isChatOpen) {
    chatContainer.classList.remove('hidden');
    switchChatTab(currentChatTab);
    markAllMessagesAsRead();
  } else {
    chatContainer.classList.add('hidden');
  }
  
  // Close floating menu
  document.getElementById('float-options').style.display = 'none';
}

// Switch between chat tabs
function switchChatTab(tab) {
  currentChatTab = tab;
  
  document.querySelectorAll('.chat-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('onclick').includes(`'${tab}'`));
  });
  
  document.getElementById('chat-public').classList.toggle('hidden', tab !== 'public');
  document.getElementById('chat-employees').classList.toggle('hidden', tab !== 'employees');
  
  if (tab === 'public') {
    loadPublicMessages();
  } else {
    loadEmployeeList();
  }
}

// Load public messages
function loadPublicMessages() {
  const messagesDiv = document.getElementById('public-messages');
  if (!messagesDiv) return;
  
  messagesDiv.innerHTML = '';
  
  db.ref('chat/public').orderByChild('timestamp').on('value', (snapshot) => {
    messagesDiv.innerHTML = '';
    
    snapshot.forEach((child) => {
      const msg = child.val();
      appendMessage(messagesDiv, msg, 'public');
    });
    
    scrollToBottom(messagesDiv);
  });
}

// Load employee list
function loadEmployeeList() {
  const employeeListDiv = document.getElementById('employee-list');
  if (!employeeListDiv) return;
  
  employeeListDiv.innerHTML = '';
  
  if (!globalEmployeeData || globalEmployeeData.length === 0) {
    employeeListDiv.innerHTML = '<p>Không có nhân viên nào.</p>';
    return;
  }
  
  globalEmployeeData.forEach(employee => {
    if (employee.id !== currentEmployeeId) {
      const employeeItem = document.createElement('div');
      employeeItem.className = 'employee-item';
      employeeItem.innerHTML = `
        <span class="status-dot" id="status-dot-${employee.id}"></span>
        <div class="employee-info">
          <strong>${employee.name || 'Không xác định'}</strong>
          <p>${employee.role || 'Nhân viên'}</p>
        </div>
      `;
      employeeItem.onclick = () => openPrivateChat(employee.id);
      employeeListDiv.appendChild(employeeItem);
      
      // Set up online status listener
      setupOnlineStatus(employee.id);
    }
  });
}

// Open private chat
function openPrivateChat(userId) {
  if (privateChatWindows[userId]) {
    return; // Chat already open
  }
  
  const employee = globalEmployeeData.find(e => e.id === userId);
  if (!employee) return;
  
  const chatId = [currentEmployeeId, userId].sort().join('_');
  privateChatWindows[userId] = true;
  
  // Load private messages
  loadPrivateMessages(userId);
  
  // Show notification if not already in chat
  if (!isChatOpen || currentChatTab !== 'private-' + userId) {
    showNotification(`Bắt đầu trò chuyện với ${employee.name}`);
  }
}

// Load private messages
function loadPrivateMessages(userId) {
  const chatId = [currentEmployeeId, userId].sort().join('_');
  
  db.ref(`chat/private/${chatId}`).orderByChild('timestamp').on('value', (snapshot) => {
    if (!snapshot.exists()) return;
    
    const messages = [];
    snapshot.forEach(child => {
      messages.push(child.val());
    });
    
    // Update unread count
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.senderId !== currentEmployeeId) {
      if (!unreadMessages.private[userId]) {
        unreadMessages.private[userId] = 0;
      }
      unreadMessages.private[userId]++;
      updateChatBadge();
      
      if (!isChatOpen) {
        showNotification(`Tin nhắn mới từ ${lastMessage.senderName}: ${lastMessage.text.substring(0, 30)}...`);
      }
    }
  });
}

// Send public message
function sendPublicMessage() {
  const input = document.getElementById('public-message-input');
  const text = input?.value.trim();
  
  if (!text || !currentEmployeeId) return;
  
  const employee = globalEmployeeData.find(e => e.id === currentEmployeeId);
  if (!employee) return;
  
  db.ref('chat/public').push({
    text,
    senderId: currentEmployeeId,
    senderName: employee.name || 'Không xác định',
    timestamp: Date.now()
  });
  
  input.value = '';
}

// Handle Enter key press
function handlePublicMessageKeyPress(e) {
  if (e.key === 'Enter') {
    sendPublicMessage();
  }
}

// Setup chat notifications
function setupChatNotifications() {
  // Public chat notifications
  db.ref('chat/public').on('child_added', (snapshot) => {
    const msg = snapshot.val();
    if (msg.senderId !== currentEmployeeId) {
      unreadMessages.public++;
      updateChatBadge();
      
      if (!isChatOpen) {
        showNotification(`Tin nhắn mới trong chat chung từ ${msg.senderName}`);
      }
    }
  });
  
  // Private chat notifications
  if (globalEmployeeData) {
    globalEmployeeData.forEach(employee => {
      if (employee.id !== currentEmployeeId) {
        const chatId = [currentEmployeeId, employee.id].sort().join('_');
        
        db.ref(`chat/private/${chatId}`).on('child_added', (snapshot) => {
          const msg = snapshot.val();
          if (msg.senderId !== currentEmployeeId) {
            if (!unreadMessages.private[employee.id]) {
              unreadMessages.private[employee.id] = 0;
            }
            unreadMessages.private[employee.id]++;
            updateChatBadge();
            
            if (!isChatOpen || !privateChatWindows[employee.id]) {
              showNotification(`Tin nhắn mới từ ${msg.senderName}: ${msg.text.substring(0, 30)}...`);
            }
          }
        });
      }
    });
  }
}

// Setup online status
function setupOnlineStatus(userId) {
  db.ref(`users/${userId}/online`).on('value', (snapshot) => {
    const statusDot = document.getElementById(`status-dot-${userId}`);
    if (statusDot) {
      statusDot.className = `status-dot ${snapshot.val() ? 'online' : 'offline'}`;
    }
  });
}

// Update chat badge
function updateChatBadge() {
  const badge = document.getElementById('chat-badge');
  if (!badge) return;
  
  const privateUnread = Object.values(unreadMessages.private).reduce((sum, count) => sum + count, 0);
  const totalUnread = unreadMessages.public + privateUnread;
  
  badge.textContent = totalUnread > 99 ? '99+' : totalUnread;
  badge.style.display = totalUnread > 0 ? 'inline-flex' : 'none';
}

// Mark all messages as read
function markAllMessagesAsRead() {
  unreadMessages.public = 0;
  for (const userId in unreadMessages.private) {
    unreadMessages.private[userId] = 0;
  }
  updateChatBadge();
}

// Show notification
function showNotification(message) {
  const container = document.getElementById('notification-container');
  if (!container) return;
  
  const notification = document.createElement('div');
  notification.className = 'notification';
  notification.textContent = message;
  container.appendChild(notification);
  
  setTimeout(() => {
    notification.classList.add('fade-out');
    setTimeout(() => notification.remove(), 500);
  }, 3000);
}

// Helper functions
function appendMessage(container, msg, type) {
  const isSent = msg.senderId === currentEmployeeId;
  const bubbleClass = isSent ? 'sent' : 'received';
  
  const messageElement = document.createElement('div');
  messageElement.className = `message-bubble ${bubbleClass}`;
  messageElement.innerHTML = `
    <div class="sender-info">${msg.senderName || 'Không xác định'} • ${formatTime(msg.timestamp)}</div>
    <div class="message-text">${msg.text}</div>
  `;
  
  container.appendChild(messageElement);
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function scrollToBottom(element) {
  element.scrollTop = element.scrollHeight;
}

// Initialize chat when the app starts
if (typeof initApp === 'function') {
  const originalInitApp = initApp;
  initApp = function() {
    originalInitApp.apply(this, arguments);
    initChat();
  };
}