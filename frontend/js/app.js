const API_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:3000/api'
  : `${window.location.origin}/api`;
let currentServer = null;
let currentChannel = null;
let currentDM = null;
let currentView = 'servers';
let messageInterval = null;

const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user'));

if (!token || !user) {
  window.location.href = 'index.html';
}

document.getElementById('username').textContent = user.username;

const userAvatarDisplay = document.getElementById('user-avatar-display');
if (user.avatar && user.avatar !== 'default.png') {
  userAvatarDisplay.style.backgroundImage = `url(${user.avatar})`;
  userAvatarDisplay.textContent = '';
} else {
  userAvatarDisplay.textContent = user.username[0].toUpperCase();
}

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${token}`
};

document.getElementById('server-settings-btn').addEventListener('click', function() {
  console.log('Botão clicado! currentServer:', currentServer);
  openServerSettings();
});

function saveAppState() {
  const state = {
    currentView,
    currentServer,
    currentChannel,
    currentDM
  };
  localStorage.setItem('appState', JSON.stringify(state));
}

function loadAppState() {
  const savedState = localStorage.getItem('appState');
  if (savedState) {
    const state = JSON.parse(savedState);
    
    if (state.currentView === 'friends') {
      showFriends();
      if (state.currentDM) {
        setTimeout(() => {
          const dmItems = document.querySelectorAll('.dm-item');
          dmItems.forEach(item => {
            if (item.onclick.toString().includes(state.currentDM)) {
              item.click();
            }
          });
        }, 500);
      }
    } else if (state.currentServer) {
      loadServersAndSelect(state.currentServer, state.currentChannel);
    } else {
      loadServersOrShowFriends();
    }
  } else {
    loadServersOrShowFriends();
  }
}

async function loadServersOrShowFriends() {
  const response = await fetch(`${API_URL}/servers`, { headers });
  const servers = await response.json();
  
  const serversList = document.getElementById('servers-list');
  serversList.innerHTML = servers.map(s => {
    const iconStyle = s.icon ? `background-image: url(${s.icon}); background-size: cover; background-position: center;` : '';
    const iconText = s.icon ? '' : s.name[0].toUpperCase();
    return `<div class="server-icon" onclick="selectServer(${s.id}, '${s.name}')" oncontextmenu="showServerContextMenu(event, ${s.id}, ${s.owner_id})" style="${iconStyle}">${iconText}</div>`;
  }).join('');
  
  if (servers.length > 0) {
    selectServer(servers[0].id, servers[0].name);
  } else {
    showFriends();
  }
}

async function loadServersAndSelect(serverId, channelId) {
  const response = await fetch(`${API_URL}/servers`, { headers });
  const servers = await response.json();
  
  const serversList = document.getElementById('servers-list');
  serversList.innerHTML = servers.map(s => {
    const iconStyle = s.icon ? `background-image: url(${s.icon}); background-size: cover; background-position: center;` : '';
    const iconText = s.icon ? '' : s.name[0].toUpperCase();
    return `<div class="server-icon" onclick="selectServer(${s.id}, '${s.name}')" oncontextmenu="showServerContextMenu(event, ${s.id}, ${s.owner_id})" style="${iconStyle}">${iconText}</div>`;
  }).join('');
  
  if (servers.length > 0) {
    const server = servers.find(s => s.id === serverId);
    if (server) {
      await selectServer(serverId, server.name);
      if (channelId) {
        setTimeout(() => {
          const channelItems = document.querySelectorAll('.channel-item');
          channelItems.forEach(item => {
            if (item.onclick.toString().includes(channelId)) {
              item.click();
            }
          });
        }, 300);
      }
    } else {
      selectServer(servers[0].id, servers[0].name);
    }
  } else {
    showFriends();
  }
}

async function loadServers() {
  currentView = 'servers';
  const response = await fetch(`${API_URL}/servers`, { headers });
  const servers = await response.json();
  
  const serversList = document.getElementById('servers-list');
  serversList.innerHTML = servers.map(s => {
    const iconStyle = s.icon ? `background-image: url(${s.icon}); background-size: cover; background-position: center;` : '';
    const iconText = s.icon ? '' : s.name[0].toUpperCase();
    return `<div class="server-icon" onclick="selectServer(${s.id}, '${s.name}')" oncontextmenu="showServerContextMenu(event, ${s.id}, ${s.owner_id})" style="${iconStyle}">${iconText}</div>`;
  }).join('');
  
  if (servers.length > 0) {
    selectServer(servers[0].id, servers[0].name);
  } else {
    showFriends();
  }
}

async function showFriends() {
  currentView = 'friends';
  currentServer = null;
  currentChannel = null;
  currentDM = null;
  saveAppState();
  
  if (messageInterval) clearInterval(messageInterval);
  
  document.getElementById('server-settings-btn').style.display = 'none';
  document.getElementById('members-sidebar').style.display = 'none';
  document.getElementById('server-name').textContent = 'Amigos';
  
  const channelsContent = document.getElementById('channels-content');
  channelsContent.innerHTML = `
    <div class="dm-section">
      <div class="channel-category">MENSAGENS DIRETAS</div>
      <div id="dm-list"></div>
    </div>
  `;
  
  const chatArea = document.getElementById('chat-area');
  chatArea.innerHTML = `
    <div class="friends-container">
      <div class="friends-header">
        <button class="friends-tab active" onclick="showFriendsTab('all')">Todos</button>
        <button class="friends-tab" onclick="showFriendsTab('pending')">Pendentes</button>
        <button class="friends-tab" onclick="showFriendsTab('add')">Adicionar Amigo</button>
      </div>
      <div id="friends-content"></div>
    </div>
  `;
  
  loadDMs();
  showFriendsTab('all');
}

async function loadDMs() {
  const response = await fetch(`${API_URL}/friends`, { headers });
  const friends = await response.json();
  
  const dmList = document.getElementById('dm-list');
  dmList.innerHTML = friends.map(f => `
    <div class="dm-item" onclick="openDM(${f.friend_user_id}, '${f.username}')">
      <div class="dm-avatar" style="${f.avatar && f.avatar !== 'default.png' ? `background-image: url(${f.avatar});` : ''}">
        ${!f.avatar || f.avatar === 'default.png' ? f.username[0].toUpperCase() : ''}
      </div>
      <span>${f.username}</span>
    </div>
  `).join('');
}

async function showFriendsTab(tab) {
  document.querySelectorAll('.friends-tab').forEach(t => t.classList.remove('active'));
  
  const clickedTab = document.querySelector(`.friends-tab[onclick*="'${tab}'"]`);
  if (clickedTab) clickedTab.classList.add('active');
  
  const content = document.getElementById('friends-content');
  
  if (tab === 'all') {
    const response = await fetch(`${API_URL}/friends`, { headers });
    const friends = await response.json();
    
    content.innerHTML = friends.map(f => `
      <div class="friend-item">
        <div class="friend-info">
          <div class="dm-avatar" style="${f.avatar && f.avatar !== 'default.png' ? `background-image: url(${f.avatar});` : ''}">
            ${!f.avatar || f.avatar === 'default.png' ? f.username[0].toUpperCase() : ''}
          </div>
          <span class="clickable-username" onclick="viewProfile(${f.friend_user_id})">${f.username}</span>
        </div>
        <div class="friend-actions">
          <button class="btn-primary" onclick="openDM(${f.friend_user_id}, '${f.username}')">Mensagem</button>
          <button class="btn-danger" onclick="removeFriend(${f.id})">Remover</button>
        </div>
      </div>
    `).join('') || '<p style="color: #b9bbbe; text-align: center; padding: 24px;">Nenhum amigo ainda</p>';
  } else if (tab === 'pending') {
    const response = await fetch(`${API_URL}/friends/pending`, { headers });
    const requests = await response.json();
    
    content.innerHTML = requests.map(r => `
      <div class="friend-item">
        <div class="friend-info">
          <div class="dm-avatar" style="${r.avatar && r.avatar !== 'default.png' ? `background-image: url(${r.avatar});` : ''}">
            ${!r.avatar || r.avatar === 'default.png' ? r.username[0].toUpperCase() : ''}
          </div>
          <span>${r.username}</span>
          <span class="pending-badge">PENDENTE</span>
        </div>
        <div class="friend-actions">
          <button class="btn-primary" onclick="acceptFriend(${r.id})">Aceitar</button>
          <button class="btn-danger" onclick="removeFriend(${r.id})">Recusar</button>
        </div>
      </div>
    `).join('') || '<p style="color: #b9bbbe; text-align: center; padding: 24px;">Nenhuma solicitação pendente</p>';
  } else if (tab === 'add') {
    content.innerHTML = `
      <div class="add-friend-section">
        <h3>Adicionar Amigo</h3>
        <div class="add-friend-input">
          <input type="text" id="search-username" placeholder="Digite o nome do usuário..." oninput="searchUsers()">
        </div>
        <div class="search-results" id="search-results"></div>
      </div>
    `;
  }
}

async function searchUsers() {
  const username = document.getElementById('search-username').value.trim();
  if (!username) {
    document.getElementById('search-results').innerHTML = '';
    return;
  }
  
  const response = await fetch(`${API_URL}/users/search?username=${username}`, { headers });
  const users = await response.json();
  
  document.getElementById('search-results').innerHTML = users.map(u => `
    <div class="friend-item">
      <div class="friend-info">
        <div class="dm-avatar" style="${u.avatar && u.avatar !== 'default.png' ? `background-image: url(${u.avatar});` : ''}">
          ${!u.avatar || u.avatar === 'default.png' ? u.username[0].toUpperCase() : ''}
        </div>
        <span>${u.username}</span>
      </div>
      <button class="btn-primary" onclick="sendFriendRequest(${u.id})">Adicionar</button>
    </div>
  `).join('');
}

async function sendFriendRequest(friendId) {
  const response = await fetch(`${API_URL}/friends/request`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ friend_id: friendId })
  });
  
  if (response.ok) {
    alert('Solicitação enviada!');
    document.getElementById('search-username').value = '';
    document.getElementById('search-results').innerHTML = '';
  }
}

async function acceptFriend(friendshipId) {
  await fetch(`${API_URL}/friends/accept/${friendshipId}`, {
    method: 'POST',
    headers
  });
  showFriendsTab('pending');
  loadDMs();
}

async function removeFriend(friendshipId) {
  if (!confirm('Tem certeza que deseja remover este amigo?')) return;
  
  await fetch(`${API_URL}/friends/${friendshipId}`, {
    method: 'DELETE',
    headers
  });
  showFriendsTab('all');
  loadDMs();
}

async function openDM(friendId, friendName) {
  currentDM = friendId;
  currentChannel = null;
  currentServer = null;
  saveAppState();
  
  if (messageInterval) clearInterval(messageInterval);
  
  document.querySelectorAll('.dm-item').forEach(el => el.classList.remove('active'));
  event.target.closest('.dm-item').classList.add('active');
  
  const chatArea = document.getElementById('chat-area');
  chatArea.innerHTML = `
    <div class="chat-header" style="display: flex; justify-content: space-between; align-items: center;">
      <h3 id="channel-name">@ ${friendName}</h3>
      <button class="call-button" onclick="toggleCall()">📞 Ligar</button>
    </div>
    <div class="messages-container" id="messages"></div>
    <div class="message-input-container">
      <input type="text" id="message-input" placeholder="Enviar mensagem para @${friendName}..." onkeypress="handleMessageKeyPress(event)">
      <button onclick="sendMessage()">Enviar</button>
    </div>
  `;
  
  loadDMMessages();
  messageInterval = setInterval(loadDMMessages, 3000);
}

async function loadDMMessages() {
  if (!currentDM) return;
  
  const response = await fetch(`${API_URL}/dm/${currentDM}`, { headers });
  const messages = await response.json();
  
  const messagesContainer = document.getElementById('messages');
  messagesContainer.innerHTML = messages.map(m => {
    let content = m.content;
    content = content.replace(/@(\w+)/g, '<span class="mention" onclick="viewProfileByUsername(\'$1\')">@$1</span>');
    
    return `
      <div class="message">
        <div class="message-avatar" style="${m.avatar && m.avatar !== 'default.png' ? `background-image: url(${m.avatar}); background-size: cover;` : ''}">
          ${!m.avatar || m.avatar === 'default.png' ? m.username[0].toUpperCase() : ''}
        </div>
        <div class="message-content">
          <div class="message-header">
            <span class="message-username">${m.username}</span>
            <span class="message-timestamp">${new Date(m.created_at).toLocaleString()}</span>
          </div>
          <div class="message-text">${content}</div>
        </div>
      </div>
    `;
  }).join('');
  
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

async function selectServer(serverId, serverName) {
  console.log('selectServer chamado:', serverId, serverName);
  
  currentServer = serverId;
  currentDM = null;
  currentView = 'servers';
  saveAppState();
  
  console.log('currentServer definido como:', currentServer);
  
  if (messageInterval) clearInterval(messageInterval);
  
  const settingsBtn = document.getElementById('server-settings-btn');
  if (settingsBtn) {
    settingsBtn.style.display = 'block';
  }
  
  if (!serverName) {
    const response = await fetch(`${API_URL}/servers`, { headers });
    const servers = await response.json();
    const server = servers.find(s => s.id === serverId);
    serverName = server ? server.name : 'Servidor';
  }
  
  document.getElementById('server-name').textContent = serverName;
  document.getElementById('members-sidebar').style.display = 'flex';
  
  const channelsContent = document.getElementById('channels-content');
  channelsContent.innerHTML = `
    <div class="channel-category">CANAIS DE TEXTO</div>
    <div class="channel-actions">
      <button onclick="createChannel()">+ Criar Canal</button>
    </div>
    <div id="channels-list"></div>
  `;
  
  const chatArea = document.getElementById('chat-area');
  chatArea.innerHTML = `
    <div class="chat-header">
      <h3 id="channel-name"># geral</h3>
    </div>
    <div class="messages-container" id="messages"></div>
    <div class="message-input-container">
      <input type="text" id="message-input" placeholder="Enviar mensagem..." onkeypress="handleMessageKeyPress(event)">
      <button onclick="sendMessage()">Enviar</button>
    </div>
  `;
  
  const response = await fetch(`${API_URL}/channels/${serverId}`, { headers });
  const channels = await response.json();
  
  const channelsList = document.getElementById('channels-list');
  channelsList.innerHTML = channels.map(c => 
    `<div class="channel-item" onclick="selectChannel(${c.id}, '${c.name}')">${c.name}</div>`
  ).join('');
  
  loadServerMembers();
  
  if (channels.length > 0) {
    selectChannel(channels[0].id, channels[0].name);
  }
}

async function selectChannel(channelId, channelName) {
  currentChannel = channelId;
  currentDM = null;
  saveAppState();
  
  if (messageInterval) clearInterval(messageInterval);
  
  document.getElementById('channel-name').textContent = `# ${channelName}`;
  
  document.querySelectorAll('.channel-item').forEach(el => el.classList.remove('active'));
  event.target.classList.add('active');
  
  loadMessages();
  messageInterval = setInterval(loadMessages, 3000);
}

async function loadMessages() {
  if (!currentChannel) return;
  
  const response = await fetch(`${API_URL}/messages/${currentChannel}`, { headers });
  const messages = await response.json();
  
  const messagesContainer = document.getElementById('messages');
  messagesContainer.innerHTML = messages.map(m => {
    let content = m.content;
    content = content.replace(/@(\w+)/g, '<span class="mention" onclick="viewProfileByUsername(\'$1\')">@$1</span>');
    
    return `
      <div class="message">
        <div class="message-avatar" style="${m.avatar && m.avatar !== 'default.png' ? `background-image: url(${m.avatar}); background-size: cover;` : ''}">
          ${!m.avatar || m.avatar === 'default.png' ? m.username[0].toUpperCase() : ''}
        </div>
        <div class="message-content">
          <div class="message-header">
            <span class="message-username clickable-username" onclick="viewProfile(${m.user_id})">${m.username}</span>
            <span class="message-timestamp">${new Date(m.created_at).toLocaleString()}</span>
          </div>
          <div class="message-text">${content}</div>
        </div>
      </div>
    `;
  }).join('');
  
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

async function sendMessage() {
  const input = document.getElementById('message-input');
  const content = input.value.trim();
  
  if (!content) return;
  
  if (currentDM) {
    await fetch(`${API_URL}/dm`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ content, receiver_id: currentDM })
    });
    input.value = '';
    loadDMMessages();
  } else if (currentChannel) {
    await fetch(`${API_URL}/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ content, channel_id: currentChannel })
    });
    input.value = '';
    loadMessages();
  }
}

function handleMessageKeyPress(event) {
  if (event.key === 'Enter') {
    sendMessage();
  }
}

async function createServer() {
  openModal('serverModal');
}

function openModal(modalId) {
  document.getElementById(modalId).classList.add('show');
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('show');
}

async function submitCreateServer() {
  const name = document.getElementById('server-name-input').value.trim();
  if (!name) return alert('Digite um nome para o servidor');
  
  const response = await fetch(`${API_URL}/servers`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name })
  });
  
  const server = await response.json();
  
  await fetch(`${API_URL}/channels`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: 'geral', server_id: server.id })
  });
  
  closeModal('serverModal');
  document.getElementById('server-name-input').value = '';
  
  const serversResponse = await fetch(`${API_URL}/servers`, { headers });
  const servers = await serversResponse.json();
  
  const serversList = document.getElementById('servers-list');
  serversList.innerHTML = servers.map(s => {
    const iconStyle = s.icon ? `background-image: url(${s.icon}); background-size: cover; background-position: center;` : '';
    const iconText = s.icon ? '' : s.name[0].toUpperCase();
    return `<div class="server-icon" onclick="selectServer(${s.id}, '${s.name}')" oncontextmenu="showServerContextMenu(event, ${s.id}, ${s.owner_id})" style="${iconStyle}">${iconText}</div>`;
  }).join('');
  
  selectServer(server.id, server.name);
}

function createChannel() {
  if (!currentServer) return alert('Selecione um servidor primeiro');
  openModal('channelModal');
}

async function submitCreateChannel() {
  const name = document.getElementById('channel-name-input').value.trim();
  if (!name) return alert('Digite um nome para o canal');
  
  await fetch(`${API_URL}/channels`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name, server_id: currentServer })
  });
  
  closeModal('channelModal');
  document.getElementById('channel-name-input').value = '';
  selectServer(currentServer, document.getElementById('server-name').textContent);
}

async function openServerSettings() {
  if (!currentServer) {
    alert('Selecione um servidor primeiro');
    return;
  }
  
  try {
    const membersResponse = await fetch(`${API_URL}/members/${currentServer}`, { headers });
    if (!membersResponse.ok) throw new Error('Erro ao buscar membros');
    const members = await membersResponse.json();
    
    const currentMember = members.find(m => m.user_id === user.id);
    
    if (!currentMember) {
      alert('Você não é membro deste servidor');
      return;
    }
    
    const isOwner = currentMember.owner_id === user.id;
    
    if (!isOwner) {
      const modal = document.createElement('div');
      modal.className = 'modal show';
      modal.innerHTML = `
        <div class="modal-content" style="width: 300px;">
          <div class="modal-header">
            <h2>Opções do Servidor</h2>
            <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
          </div>
          <div class="modal-body" style="display: flex; flex-direction: column; gap: 12px;">
            <button class="btn-primary" onclick="createInvite(); this.closest('.modal').remove();" style="width: 100%;">Convidar Pessoas</button>
            <button class="btn-danger" onclick="leaveServerFromSettings(${currentMember.id}); this.closest('.modal').remove();" style="width: 100%;">Sair do Servidor</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      return;
    }
    
    document.getElementById('edit-server-name').value = document.getElementById('server-name').textContent;
    
    const rolesResponse = await fetch(`${API_URL}/roles/${currentServer}`, { headers });
    if (!rolesResponse.ok) throw new Error('Erro ao buscar cargos');
    const roles = await rolesResponse.json();
    
    const rolesList = document.getElementById('roles-list');
    rolesList.innerHTML = roles.map(r => `
      <div class="role-item">
        <div class="role-info">
          <div class="role-color" style="background: ${r.color}"></div>
          <span>${r.name}</span>
        </div>
        <div class="role-actions">
          <button class="btn-danger" onclick="deleteRole(${r.id})">Deletar</button>
        </div>
      </div>
    `).join('');
    
    const membersTable = document.getElementById('members-table-body');
    if (!membersTable) {
      console.error('Elemento members-table-body não encontrado');
      throw new Error('Tabela de membros não encontrada');
    }
    
    membersTable.innerHTML = members.map(m => {
      const isMemberOwner = m.owner_id === m.user_id;
      const isCurrentUser = m.user_id === user.id;
      
      return `
        <tr>
          <td>
            <div class="member-name-cell">
              <div class="member-avatar" style="${m.avatar && m.avatar !== 'default.png' ? `background-image: url(${m.avatar}); background-size: cover;` : ''}">
                ${!m.avatar || m.avatar === 'default.png' ? m.username[0].toUpperCase() : ''}
              </div>
              <div>
                <span class="clickable-username" onclick="viewProfile(${m.user_id})">${m.username}</span>
                ${isMemberOwner ? '<span class="badge-owner">DONO</span>' : ''}
                ${m.is_admin && !isMemberOwner ? '<span class="badge-admin">ADMIN</span>' : ''}
              </div>
            </div>
          </td>
          <td>
            <select onchange="updateMemberRole(${m.id}, this.value)" ${isMemberOwner || isCurrentUser ? 'disabled' : ''}>
              <option value="">Sem cargo</option>
              ${roles.map(r => `<option value="${r.id}" ${m.role_id === r.id ? 'selected' : ''}>${r.name}</option>`).join('')}
            </select>
          </td>
          <td>
            <select onchange="toggleAdmin(${m.id}, this.value)" ${isMemberOwner || isCurrentUser ? 'disabled' : ''}>
              <option value="0" ${!m.is_admin ? 'selected' : ''}>Membro</option>
              <option value="1" ${m.is_admin ? 'selected' : ''}>Admin</option>
            </select>
          </td>
          <td>
            <div class="member-actions">
              ${!isMemberOwner && !isCurrentUser ? `
                <button class="btn-danger" onclick="kickMember(${m.id})">Expulsar</button>
                <button class="btn-danger" onclick="banMember(${m.id})">Banir</button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');
    
    openModal('serverSettingsModal');
  } catch (error) {
    console.error('Erro detalhado:', error);
    alert('Erro ao carregar configurações: ' + error.message);
  }
}

async function leaveServerFromSettings(memberId) {
  if (!confirm('Tem certeza que deseja sair deste servidor?')) return;
  
  try {
    await fetch(`${API_URL}/members/${memberId}/kick`, {
      method: 'POST',
      headers
    });
    
    alert('Você saiu do servidor!');
    
    currentServer = null;
    
    const serversResponse = await fetch(`${API_URL}/servers`, { headers });
    const servers = await serversResponse.json();
    
    const serversList = document.getElementById('servers-list');
    serversList.innerHTML = servers.map(s => 
      `<div class="server-icon" onclick="selectServer(${s.id}, '${s.name}')" oncontextmenu="showServerContextMenu(event, ${s.id}, ${s.owner_id})">${s.name[0].toUpperCase()}</div>`
    ).join('');
    
    if (servers.length > 0) {
      selectServer(servers[0].id, servers[0].name);
    } else {
      showFriends();
    }
  } catch (error) {
    alert('Erro ao sair do servidor');
  }
}

async function updateMemberRole(memberId, roleId) {
  await fetch(`${API_URL}/members/${memberId}/role`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ role_id: roleId || null })
  });
  openServerSettings();
}

async function toggleAdmin(memberId, isAdmin) {
  await fetch(`${API_URL}/members/${memberId}/admin`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ is_admin: parseInt(isAdmin) })
  });
  openServerSettings();
}

async function kickMember(memberId) {
  if (!confirm('Tem certeza que deseja expulsar este membro?')) return;
  
  await fetch(`${API_URL}/members/${memberId}/kick`, {
    method: 'POST',
    headers
  });
  openServerSettings();
}

async function banMember(memberId) {
  if (!confirm('Tem certeza que deseja banir este membro?')) return;
  
  await fetch(`${API_URL}/members/${memberId}/ban`, {
    method: 'POST',
    headers
  });
  openServerSettings();
}

async function updateServerName() {
  const name = document.getElementById('edit-server-name').value.trim();
  if (!name) return alert('Digite um nome para o servidor');
  
  await fetch(`${API_URL}/servers/${currentServer}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ name })
  });
  
  closeModal('serverSettingsModal');
  
  const response = await fetch(`${API_URL}/servers`, { headers });
  const servers = await response.json();
  
  const serversList = document.getElementById('servers-list');
  serversList.innerHTML = servers.map(s => {
    const iconStyle = s.icon ? `background-image: url(${s.icon}); background-size: cover; background-position: center;` : '';
    const iconText = s.icon ? '' : s.name[0].toUpperCase();
    return `<div class="server-icon" onclick="selectServer(${s.id}, '${s.name}')" oncontextmenu="showServerContextMenu(event, ${s.id}, ${s.owner_id})" style="${iconStyle}">${iconText}</div>`;
  }).join('');
  
  document.getElementById('server-name').textContent = name;
}

async function deleteServer() {
  if (!confirm('Tem certeza que deseja deletar este servidor?')) return;
  
  await fetch(`${API_URL}/servers/${currentServer}`, {
    method: 'DELETE',
    headers
  });
  
  closeModal('serverSettingsModal');
  currentServer = null;
  
  const response = await fetch(`${API_URL}/servers`, { headers });
  const servers = await response.json();
  
  const serversList = document.getElementById('servers-list');
  serversList.innerHTML = servers.map(s => {
    const iconStyle = s.icon ? `background-image: url(${s.icon}); background-size: cover; background-position: center;` : '';
    const iconText = s.icon ? '' : s.name[0].toUpperCase();
    return `<div class="server-icon" onclick="selectServer(${s.id}, '${s.name}')" oncontextmenu="showServerContextMenu(event, ${s.id}, ${s.owner_id})" style="${iconStyle}">${iconText}</div>`;
  }).join('');
  
  if (servers.length > 0) {
    selectServer(servers[0].id, servers[0].name);
  } else {
    showFriends();
  }
}

function openCreateRole() {
  closeModal('serverSettingsModal');
  openModal('roleModal');
}

async function submitCreateRole() {
  const name = document.getElementById('role-name-input').value.trim();
  const color = document.getElementById('role-color-input').value;
  
  if (!name) return alert('Digite um nome para o cargo');
  
  await fetch(`${API_URL}/roles`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name, color, server_id: currentServer })
  });
  
  closeModal('roleModal');
  document.getElementById('role-name-input').value = '';
  openServerSettings();
}

async function deleteRole(roleId) {
  if (!confirm('Tem certeza que deseja deletar este cargo?')) return;
  
  await fetch(`${API_URL}/roles/${roleId}`, {
    method: 'DELETE',
    headers
  });
  
  openServerSettings();
}

function openUserSettings() {
  document.getElementById('edit-username').value = user.username;
  document.getElementById('edit-avatar').value = user.avatar || '';
  document.getElementById('edit-banner').value = user.banner || '';
  document.getElementById('edit-bio').value = user.bio || '';
  
  const avatarPreview = document.getElementById('avatar-preview');
  if (user.avatar && user.avatar !== 'default.png') {
    avatarPreview.style.backgroundImage = `url(${user.avatar})`;
    avatarPreview.textContent = '';
  } else {
    avatarPreview.style.backgroundImage = '';
    avatarPreview.textContent = user.username[0].toUpperCase();
  }
  
  const bannerPreview = document.getElementById('banner-preview');
  if (user.banner) {
    bannerPreview.style.backgroundImage = `url(${user.banner})`;
  } else {
    bannerPreview.style.backgroundImage = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
  }
  
  openModal('userSettingsModal');
}

async function updateAvatar() {
  const avatar = document.getElementById('edit-avatar').value.trim();
  
  const response = await fetch(`${API_URL}/user/avatar`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ avatar })
  });
  
  if (response.ok) {
    user.avatar = avatar;
    localStorage.setItem('user', JSON.stringify(user));
    
    const userAvatarDisplay = document.getElementById('user-avatar-display');
    if (avatar && avatar !== 'default.png') {
      userAvatarDisplay.style.backgroundImage = `url(${avatar})`;
      userAvatarDisplay.textContent = '';
    } else {
      userAvatarDisplay.style.backgroundImage = '';
      userAvatarDisplay.textContent = user.username[0].toUpperCase();
    }
    
    alert('Avatar atualizado com sucesso!');
    openUserSettings();
  } else {
    alert('Erro ao atualizar avatar');
  }
}

async function updateBanner() {
  const banner = document.getElementById('edit-banner').value.trim();
  
  const response = await fetch(`${API_URL}/user/banner`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ banner })
  });
  
  if (response.ok) {
    user.banner = banner;
    localStorage.setItem('user', JSON.stringify(user));
    alert('Banner atualizado com sucesso!');
    openUserSettings();
  } else {
    alert('Erro ao atualizar banner');
  }
}

async function updateBio() {
  const bio = document.getElementById('edit-bio').value.trim();
  
  const response = await fetch(`${API_URL}/user/bio`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ bio })
  });
  
  if (response.ok) {
    user.bio = bio;
    localStorage.setItem('user', JSON.stringify(user));
    alert('Bio atualizada com sucesso!');
  } else {
    alert('Erro ao atualizar bio');
  }
}

async function viewProfile(userId) {
  const response = await fetch(`${API_URL}/user/${userId}`, { headers });
  const profile = await response.json();
  
  const banner = document.getElementById('profile-banner');
  if (profile.banner) {
    banner.style.backgroundImage = `url(${profile.banner})`;
  } else {
    banner.style.backgroundImage = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
  }
  
  const avatar = document.getElementById('profile-avatar');
  if (profile.avatar && profile.avatar !== 'default.png') {
    avatar.style.backgroundImage = `url(${profile.avatar})`;
    avatar.textContent = '';
  } else {
    avatar.style.backgroundImage = '';
    avatar.textContent = profile.username[0].toUpperCase();
  }
  
  document.getElementById('profile-username').textContent = profile.username;
  document.getElementById('profile-bio').textContent = profile.bio || 'Este usuário não tem uma bio.';
  document.getElementById('profile-joined').textContent = new Date(profile.created_at).toLocaleDateString();
  
  openModal('profileModal');
}

function loadServers() {
  currentView = 'servers';
  fetch(`${API_URL}/servers`, { headers })
    .then(res => res.json())
    .then(servers => {
      const serversList = document.getElementById('servers-list');
      serversList.innerHTML = servers.map(s => {
        const iconStyle = s.icon ? `background-image: url(${s.icon}); background-size: cover; background-position: center;` : '';
        const iconText = s.icon ? '' : s.name[0].toUpperCase();
        return `<div class="server-icon" onclick="selectServer(${s.id}, '${s.name}')" oncontextmenu="showServerContextMenu(event, ${s.id}, ${s.owner_id})" style="${iconStyle}">${iconText}</div>`;
      }).join('');
      
      if (servers.length > 0) {
        selectServer(servers[0].id, servers[0].name);
      }
    });
}

async function updateUsername() {
  const username = document.getElementById('edit-username').value.trim();
  if (!username) return alert('Digite um nome de usuário');
  
  const response = await fetch(`${API_URL}/user/username`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ username })
  });
  
  if (response.ok) {
    user.username = username;
    localStorage.setItem('user', JSON.stringify(user));
    document.getElementById('username').textContent = username;
    
    const userAvatarDisplay = document.getElementById('user-avatar-display');
    if (!user.avatar || user.avatar === 'default.png') {
      userAvatarDisplay.textContent = username[0].toUpperCase();
    }
    
    alert('Nome atualizado com sucesso!');
  } else {
    alert('Erro ao atualizar nome');
  }
}

async function updatePassword() {
  const oldPassword = document.getElementById('old-password').value;
  const newPassword = document.getElementById('new-password').value;
  
  if (!oldPassword || !newPassword) return alert('Preencha todos os campos');
  
  const response = await fetch(`${API_URL}/user/password`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ oldPassword, newPassword })
  });
  
  const data = await response.json();
  
  if (response.ok) {
    alert('Senha atualizada com sucesso!');
    document.getElementById('old-password').value = '';
    document.getElementById('new-password').value = '';
  } else {
    alert(data.error || 'Erro ao atualizar senha');
  }
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('appState');
  window.location.href = 'index.html';
}

let mentionMembers = [];

async function handleMentionInput(event) {
  const input = event.target;
  const value = input.value;
  const cursorPos = input.selectionStart;
  const textBeforeCursor = value.substring(0, cursorPos);
  const lastAtSymbol = textBeforeCursor.lastIndexOf('@');
  
  if (lastAtSymbol !== -1) {
    const searchText = textBeforeCursor.substring(lastAtSymbol + 1);
    
    if (searchText.length > 0 && currentServer) {
      const response = await fetch(`${API_URL}/members/${currentServer}`, { headers });
      const members = await response.json();
      mentionMembers = members;
      
      const filtered = members.filter(m => 
        m.username.toLowerCase().includes(searchText.toLowerCase())
      );
      
      if (filtered.length > 0) {
        showMentionSuggestions(filtered, lastAtSymbol);
      } else {
        hideMentionSuggestions();
      }
    } else {
      hideMentionSuggestions();
    }
  } else {
    hideMentionSuggestions();
  }
}

function showMentionSuggestions(members, atPosition) {
  const suggestionsDiv = document.getElementById('mention-suggestions');
  
  suggestionsDiv.innerHTML = members.map(m => `
    <div class="mention-item" onclick="insertMention('${m.username}', ${atPosition})">
      <div class="mention-avatar" style="${m.avatar && m.avatar !== 'default.png' ? `background-image: url(${m.avatar});` : ''}">
        ${!m.avatar || m.avatar === 'default.png' ? m.username[0].toUpperCase() : ''}
      </div>
      <span>${m.username}</span>
    </div>
  `).join('');
  
  suggestionsDiv.style.display = 'block';
}

function hideMentionSuggestions() {
  const suggestionsDiv = document.getElementById('mention-suggestions');
  if (suggestionsDiv) {
    suggestionsDiv.style.display = 'none';
  }
}

function insertMention(username, atPosition) {
  const input = document.getElementById('message-input');
  const value = input.value;
  const beforeAt = value.substring(0, atPosition);
  const afterCursor = value.substring(input.selectionStart);
  
  input.value = beforeAt + '@' + username + ' ' + afterCursor;
  input.focus();
  
  const newCursorPos = beforeAt.length + username.length + 2;
  input.setSelectionRange(newCursorPos, newCursorPos);
  
  hideMentionSuggestions();
}

async function viewProfileByUsername(username) {
  const response = await fetch(`${API_URL}/users/search?username=${username}`, { headers });
  const users = await response.json();
  
  if (users.length > 0) {
    viewProfile(users[0].id);
  }
}

async function loadServerMembers() {
  if (!currentServer) return;
  
  try {
    const rolesResponse = await fetch(`${API_URL}/roles/${currentServer}`, { headers });
    const roles = await rolesResponse.json();
    
    const membersResponse = await fetch(`${API_URL}/members/${currentServer}`, { headers });
    const membersData = await membersResponse.json();
    
    if (!membersResponse.ok || !Array.isArray(membersData)) {
      console.error('Erro ao carregar membros:', membersData);
      document.getElementById('members-list').innerHTML = '<p style="padding: 16px; color: #b9bbbe;">Erro ao carregar membros</p>';
      return;
    }
    
    const members = membersData;
    const membersList = document.getElementById('members-list');
    
    if (members.length === 0) {
      membersList.innerHTML = '<p style="padding: 16px; color: #b9bbbe;">Nenhum membro no servidor</p>';
      return;
    }
    
    const groupedMembers = {};
    groupedMembers['online'] = members.filter(m => m.owner_id === m.user_id || m.is_admin);
    
    roles.forEach(role => {
      groupedMembers[role.name] = members.filter(m => m.role_id === role.id && !groupedMembers['online'].includes(m));
    });
    
    groupedMembers['sem-cargo'] = members.filter(m => 
      !m.role_id && !groupedMembers['online'].includes(m)
    );
    
    let html = '';
    
    if (groupedMembers['online'].length > 0) {
      html += `
        <div class="member-role-group">
          <div class="member-role-title">Online — ${groupedMembers['online'].length}</div>
          ${groupedMembers['online'].map(m => `
            <div class="member-list-item" onclick="viewProfile(${m.user_id})">
              <div class="member-list-avatar" style="${m.avatar && m.avatar !== 'default.png' ? `background-image: url(${m.avatar});` : ''}">
                ${!m.avatar || m.avatar === 'default.png' ? m.username[0].toUpperCase() : ''}
                <div class="online-indicator"></div>
              </div>
              <div class="member-list-name">${m.username}</div>
            </div>
          `).join('')}
        </div>
      `;
    }
    
    roles.forEach(role => {
      if (groupedMembers[role.name] && groupedMembers[role.name].length > 0) {
        html += `
          <div class="member-role-group">
            <div class="member-role-title" style="color: ${role.color}">${role.name} — ${groupedMembers[role.name].length}</div>
            ${groupedMembers[role.name].map(m => `
              <div class="member-list-item" onclick="viewProfile(${m.user_id})">
                <div class="member-list-avatar" style="${m.avatar && m.avatar !== 'default.png' ? `background-image: url(${m.avatar});` : ''}">
                  ${!m.avatar || m.avatar === 'default.png' ? m.username[0].toUpperCase() : ''}
                </div>
                <div class="member-list-name" style="color: ${role.color}">${m.username}</div>
              </div>
            `).join('')}
          </div>
        `;
      }
    });
    
    if (groupedMembers['sem-cargo'].length > 0) {
      html += `
        <div class="member-role-group">
          <div class="member-role-title">Membros — ${groupedMembers['sem-cargo'].length}</div>
          ${groupedMembers['sem-cargo'].map(m => `
            <div class="member-list-item" onclick="viewProfile(${m.user_id})">
              <div class="member-list-avatar" style="${m.avatar && m.avatar !== 'default.png' ? `background-image: url(${m.avatar});` : ''}">
                ${!m.avatar || m.avatar === 'default.png' ? m.username[0].toUpperCase() : ''}
              </div>
              <div class="member-list-name">${m.username}</div>
            </div>
          `).join('')}
        </div>
      `;
    }
    
    membersList.innerHTML = html;
  } catch (error) {
    console.error('Erro ao carregar membros:', error);
    document.getElementById('members-list').innerHTML = '<p style="padding: 16px; color: #b9bbbe;">Erro ao carregar membros</p>';
  }
}

let currentServerContext = null;
let isOwnerContext = false;

function showServerContextMenu(event, serverId, ownerId) {
  event.preventDefault();
  currentServerContext = serverId;
  isOwnerContext = (ownerId === user.id);
  
  const menu = document.getElementById('server-context-menu');
  menu.style.display = 'block';
  menu.style.left = event.pageX + 'px';
  menu.style.top = event.pageY + 'px';
  
  if (isOwnerContext) {
    menu.innerHTML = `
      <div class="context-menu-item" onclick="openServerSettings()">Configurações do Servidor</div>
      <div class="context-menu-item" onclick="createInvite()">Convidar Pessoas</div>
      <div class="context-menu-item" onclick="changeServerName()">Alterar Nome</div>
      <div class="context-menu-item" onclick="changeServerIcon()">Alterar Ícone</div>
      <div class="context-menu-divider"></div>
      <div class="context-menu-item danger" onclick="deleteServerFromContext()">Deletar Servidor</div>
    `;
  } else {
    menu.innerHTML = `
      <div class="context-menu-item" onclick="createInvite()">Convidar Pessoas</div>
      <div class="context-menu-divider"></div>
      <div class="context-menu-item danger" onclick="leaveServer()">Sair do Servidor</div>
    `;
  }
}

function changeServerIcon() {
  const icon = prompt('Digite a URL do ícone do servidor:');
  if (!icon) {
    hideContextMenu();
    return;
  }
  
  const serverId = currentServerContext || currentServer;
  
  fetch(`${API_URL}/servers/${serverId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ icon })
  })
  .then(res => res.json())
  .then(() => {
    alert('Ícone do servidor atualizado!');
    hideContextMenu();
    
    fetch(`${API_URL}/servers`, { headers })
      .then(res => res.json())
      .then(servers => {
        const serversList = document.getElementById('servers-list');
        serversList.innerHTML = servers.map(s => {
          const iconStyle = s.icon ? `background-image: url(${s.icon}); background-size: cover; background-position: center;` : '';
          const iconText = s.icon ? '' : s.name[0].toUpperCase();
          return `<div class="server-icon" onclick="selectServer(${s.id}, '${s.name}')" oncontextmenu="showServerContextMenu(event, ${s.id}, ${s.owner_id})" style="${iconStyle}">${iconText}</div>`;
        }).join('');
      });
  })
  .catch(() => {
    alert('Erro ao atualizar ícone do servidor');
    hideContextMenu();
  });
}

function changeServerName() {
  const name = prompt('Digite o novo nome do servidor:');
  if (!name) {
    hideContextMenu();
    return;
  }
  
  const serverId = currentServerContext || currentServer;
  
  fetch(`${API_URL}/servers/${serverId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ name })
  })
  .then(res => res.json())
  .then(() => {
    alert('Nome do servidor atualizado!');
    hideContextMenu();
    
    fetch(`${API_URL}/servers`, { headers })
      .then(res => res.json())
      .then(servers => {
        const serversList = document.getElementById('servers-list');
        serversList.innerHTML = servers.map(s => 
          `<div class="server-icon" onclick="selectServer(${s.id}, '${s.name}')" oncontextmenu="showServerContextMenu(event, ${s.id}, ${s.owner_id})">${s.name[0].toUpperCase()}</div>`
        ).join('');
        
        if (currentServer === serverId) {
          document.getElementById('server-name').textContent = name;
        }
      });
  })
  .catch(() => {
    alert('Erro ao atualizar nome do servidor');
    hideContextMenu();
  });
}

function deleteServerFromContext() {
  if (!confirm('Tem certeza que deseja deletar este servidor?')) {
    hideContextMenu();
    return;
  }
  
  const serverId = currentServerContext || currentServer;
  
  fetch(`${API_URL}/servers/${serverId}`, {
    method: 'DELETE',
    headers
  })
  .then(() => {
    hideContextMenu();
    alert('Servidor deletado!');
    
    if (currentServer === serverId) {
      currentServer = null;
    }
    
    fetch(`${API_URL}/servers`, { headers })
      .then(res => res.json())
      .then(servers => {
        const serversList = document.getElementById('servers-list');
        serversList.innerHTML = servers.map(s => 
          `<div class="server-icon" onclick="selectServer(${s.id}, '${s.name}')" oncontextmenu="showServerContextMenu(event, ${s.id}, ${s.owner_id})">${s.name[0].toUpperCase()}</div>`
        ).join('');
        
        if (servers.length > 0) {
          selectServer(servers[0].id, servers[0].name);
        } else {
          showFriends();
        }
      });
  })
  .catch(() => {
    alert('Erro ao deletar servidor');
    hideContextMenu();
  });
}

async function leaveServer() {
  if (!confirm('Tem certeza que deseja sair deste servidor?')) {
    hideContextMenu();
    return;
  }
  
  const serverId = currentServerContext || currentServer;
  hideContextMenu();
  
  try {
    const membersResponse = await fetch(`${API_URL}/members/${serverId}`, { headers });
    const members = await membersResponse.json();
    
    const myMember = members.find(m => m.user_id === user.id);
    
    if (myMember) {
      await fetch(`${API_URL}/members/${myMember.id}/kick`, {
        method: 'POST',
        headers
      });
      
      alert('Você saiu do servidor!');
      
      if (currentServer === serverId) {
        currentServer = null;
      }
      
      const serversResponse = await fetch(`${API_URL}/servers`, { headers });
      const servers = await serversResponse.json();
      
      const serversList = document.getElementById('servers-list');
      serversList.innerHTML = servers.map(s => 
        `<div class="server-icon" onclick="selectServer(${s.id}, '${s.name}')" oncontextmenu="showServerContextMenu(event, ${s.id}, ${s.owner_id})">${s.name[0].toUpperCase()}</div>`
      ).join('');
      
      if (servers.length > 0) {
        selectServer(servers[0].id, servers[0].name);
      } else {
        showFriends();
      }
    }
  } catch (error) {
    alert('Erro ao sair do servidor');
  }
}

function hideContextMenu() {
  document.getElementById('server-context-menu').style.display = 'none';
}

document.addEventListener('click', hideContextMenu);

let inCall = false;
 let micMuted = false;

function toggleCall() {
  inCall = !inCall;
  const btn = document.querySelector('.call-button');
  const voiceControls = document.getElementById('voice-controls');
  
  if (inCall) {
    btn.textContent = '📞 Desligar';
    btn.classList.add('in-call');
    if (voiceControls) voiceControls.style.display = 'flex';
    alert('Chamada iniciada! Use os controles de voz abaixo.');
  } else {
    btn.textContent = '📞 Ligar';
    btn.classList.remove('in-call');
    if (voiceControls) voiceControls.style.display = 'none';
    micMuted = false;
    updateVoiceControls();
  }
}

function toggleMic() {
  if (!inCall) return;
  micMuted = !micMuted;
  updateVoiceControls();
}

function updateVoiceControls() {
  const micBtn = document.getElementById('mic-btn');
  if (micBtn) {
    if (micMuted) {
      micBtn.classList.add('muted');
      micBtn.textContent = '🎙️❌';
    } else {
      micBtn.classList.remove('muted');
      micBtn.textContent = '🎙️';
    }
  }
}

async function createInvite() {
  if (!currentServerContext && !currentServer) {
    alert('Selecione um servidor primeiro');
    return;
  }
  
  const serverId = currentServerContext || currentServer;
  hideContextMenu();
  
  try {
    const response = await fetch(`${API_URL}/invites`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ server_id: serverId })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      document.getElementById('invite-code').value = data.code;
      openModal('inviteModal');
    } else {
      alert(data.error || 'Erro ao criar convite');
    }
  } catch (error) {
    alert('Erro ao criar convite');
  }
}

function copyInvite() {
  const input = document.getElementById('invite-code');
  input.select();
  document.execCommand('copy');
  alert('Código copiado! Compartilhe com seus amigos.');
}

function openJoinServer() {
  openModal('joinServerModal');
}

async function joinServerWithCode() {
  const code = document.getElementById('join-code-input').value.trim();
  
  if (!code) {
    alert('Digite um código de convite');
    return;
  }
  
  try {
    const response = await fetch(`${API_URL}/invites/${code}/accept`, {
      method: 'POST',
      headers
    });
    
    const data = await response.json();
    
    if (response.ok) {
      closeModal('joinServerModal');
      document.getElementById('join-code-input').value = '';
      alert('Você entrou no servidor!');
      
      const serversResponse = await fetch(`${API_URL}/servers`, { headers });
      const servers = await serversResponse.json();
      
      const serversList = document.getElementById('servers-list');
      serversList.innerHTML = servers.map(s => 
        `<div class="server-icon" onclick="selectServer(${s.id}, '${s.name}')" oncontextmenu="showServerContextMenu(event, ${s.id}, ${s.owner_id})">${s.name[0].toUpperCase()}</div>`
      ).join('');
      
      selectServer(data.server_id, '');
    } else {
      alert(data.error || 'Erro ao entrar no servidor');
    }
  } catch (error) {
    alert('Erro ao entrar no servidor');
  }
}

loadAppState();
