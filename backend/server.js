require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./database');

const app = express();
app.use(cors());
app.use(express.json());

// Servir arquivos estáticos do frontend
app.use(express.static(path.join(__dirname, '../frontend')));

const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token não fornecido' });
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Token inválido' });
  }
};

app.post('/api/register', async (req, res) => {
  const { username, email, password } = req.body;
  
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  
  db.run('INSERT INTO users (username, email, password) VALUES (?, ?, ?)', 
    [username, email, hashedPassword], 
    function(err) {
      if (err) {
        return res.status(400).json({ error: 'Usuário ou email já existe' });
      }
      res.json({ message: 'Usuário registrado com sucesso', userId: this.lastID });
    }
  );
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  
  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
    if (err || !user) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }
    
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }
    
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, username: user.username, email: user.email, avatar: user.avatar, banner: user.banner, bio: user.bio } });
  });
});

app.get('/api/user', auth, (req, res) => {
  db.get('SELECT id, username, email, avatar, banner, bio FROM users WHERE id = ?', [req.userId], (err, user) => {
    if (err || !user) return res.status(404).json({ error: 'Usuário não encontrado' });
    res.json(user);
  });
});

app.get('/api/user/:userId', auth, (req, res) => {
  db.get('SELECT id, username, email, avatar, banner, bio, created_at FROM users WHERE id = ?', [req.params.userId], (err, user) => {
    if (err || !user) return res.status(404).json({ error: 'Usuário não encontrado' });
    res.json(user);
  });
});

app.put('/api/user/avatar', auth, (req, res) => {
  const { avatar } = req.body;
  db.run('UPDATE users SET avatar = ? WHERE id = ?', [avatar, req.userId], (err) => {
    if (err) return res.status(400).json({ error: 'Erro ao atualizar avatar' });
    res.json({ message: 'Avatar atualizado' });
  });
});

app.put('/api/user/banner', auth, (req, res) => {
  const { banner } = req.body;
  db.run('UPDATE users SET banner = ? WHERE id = ?', [banner, req.userId], (err) => {
    if (err) return res.status(400).json({ error: 'Erro ao atualizar banner' });
    res.json({ message: 'Banner atualizado' });
  });
});

app.put('/api/user/bio', auth, (req, res) => {
  const { bio } = req.body;
  db.run('UPDATE users SET bio = ? WHERE id = ?', [bio, req.userId], (err) => {
    if (err) return res.status(400).json({ error: 'Erro ao atualizar bio' });
    res.json({ message: 'Bio atualizada' });
  });
});

app.put('/api/user/username', auth, (req, res) => {
  const { username } = req.body;
  db.run('UPDATE users SET username = ? WHERE id = ?', [username, req.userId], (err) => {
    if (err) return res.status(400).json({ error: 'Nome de usuário já existe' });
    res.json({ message: 'Nome atualizado' });
  });
});

app.put('/api/user/password', auth, async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  db.get('SELECT password FROM users WHERE id = ?', [req.userId], async (err, user) => {
    if (err || !user) return res.status(404).json({ error: 'Usuário não encontrado' });
    const valid = await bcrypt.compare(oldPassword, user.password);
    if (!valid) return res.status(401).json({ error: 'Senha atual incorreta' });
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    db.run('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, req.userId], (err) => {
      if (err) return res.status(400).json({ error: 'Erro ao atualizar senha' });
      res.json({ message: 'Senha atualizada' });
    });
  });
});

app.post('/api/servers', auth, (req, res) => {
  const { name } = req.body;
  db.run('INSERT INTO servers (name, owner_id) VALUES (?, ?)', [name, req.userId], function(err) {
    if (err) return res.status(400).json({ error: 'Erro ao criar servidor' });
    const serverId = this.lastID;
    db.run('INSERT INTO server_members (user_id, server_id, is_admin) VALUES (?, ?, 1)', [req.userId, serverId], (err) => {
      if (err) console.error('Erro ao adicionar membro:', err);
      res.json({ id: serverId, name, owner_id: req.userId });
    });
  });
});

app.put('/api/servers/:serverId', auth, (req, res) => {
  const { name, icon } = req.body;
  db.get('SELECT owner_id FROM servers WHERE id = ?', [req.params.serverId], (err, server) => {
    if (err || !server) return res.status(404).json({ error: 'Servidor não encontrado' });
    if (server.owner_id !== req.userId) return res.status(403).json({ error: 'Sem permissão' });
    
    const updates = [];
    const values = [];
    
    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (icon !== undefined) {
      updates.push('icon = ?');
      values.push(icon);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    }
    
    values.push(req.params.serverId);
    
    db.run(`UPDATE servers SET ${updates.join(', ')} WHERE id = ?`, values, (err) => {
      if (err) return res.status(400).json({ error: 'Erro ao atualizar servidor' });
      res.json({ message: 'Servidor atualizado' });
    });
  });
});

app.delete('/api/servers/:serverId', auth, (req, res) => {
  db.get('SELECT owner_id FROM servers WHERE id = ?', [req.params.serverId], (err, server) => {
    if (err || !server) return res.status(404).json({ error: 'Servidor não encontrado' });
    if (server.owner_id !== req.userId) return res.status(403).json({ error: 'Sem permissão' });
    db.run('DELETE FROM servers WHERE id = ?', [req.params.serverId], (err) => {
      if (err) return res.status(400).json({ error: 'Erro ao deletar servidor' });
      res.json({ message: 'Servidor deletado' });
    });
  });
});

app.get('/api/servers', auth, (req, res) => {
  db.all(`SELECT DISTINCT s.* 
          FROM servers s
          JOIN server_members sm ON s.id = sm.server_id
          WHERE sm.user_id = ? AND sm.is_banned = 0`, [req.userId], (err, servers) => {
    if (err) return res.status(400).json({ error: 'Erro ao buscar servidores' });
    res.json(servers);
  });
});

app.post('/api/channels', auth, (req, res) => {
  const { name, server_id } = req.body;
  db.run('INSERT INTO channels (name, server_id) VALUES (?, ?)', [name, server_id], function(err) {
    if (err) return res.status(400).json({ error: 'Erro ao criar canal' });
    res.json({ id: this.lastID, name, server_id });
  });
});

app.delete('/api/channels/:channelId', auth, (req, res) => {
  db.run('DELETE FROM channels WHERE id = ?', [req.params.channelId], (err) => {
    if (err) return res.status(400).json({ error: 'Erro ao deletar canal' });
    res.json({ message: 'Canal deletado' });
  });
});

app.get('/api/channels/:serverId', auth, (req, res) => {
  db.all('SELECT * FROM channels WHERE server_id = ?', [req.params.serverId], (err, channels) => {
    if (err) return res.status(400).json({ error: 'Erro ao buscar canais' });
    res.json(channels);
  });
});

app.post('/api/messages', auth, (req, res) => {
  const { content, channel_id } = req.body;
  db.run('INSERT INTO messages (content, user_id, channel_id) VALUES (?, ?, ?)', 
    [content, req.userId, channel_id], 
    function(err) {
      if (err) return res.status(400).json({ error: 'Erro ao enviar mensagem' });
      res.json({ id: this.lastID, content, user_id: req.userId, channel_id });
    }
  );
});

app.get('/api/messages/:channelId', auth, (req, res) => {
  db.all(`SELECT m.*, u.username, u.avatar, u.id as user_id
          FROM messages m 
          JOIN users u ON m.user_id = u.id 
          WHERE m.channel_id = ? 
          ORDER BY m.created_at ASC`, 
    [req.params.channelId], 
    (err, messages) => {
      if (err) return res.status(400).json({ error: 'Erro ao buscar mensagens' });
      res.json(messages);
    }
  );
});

app.post('/api/roles', auth, (req, res) => {
  const { name, color, server_id } = req.body;
  db.run('INSERT INTO roles (name, color, server_id) VALUES (?, ?, ?)', [name, color, server_id], function(err) {
    if (err) return res.status(400).json({ error: 'Erro ao criar cargo' });
    res.json({ id: this.lastID, name, color, server_id });
  });
});

app.get('/api/roles/:serverId', auth, (req, res) => {
  db.all('SELECT * FROM roles WHERE server_id = ?', [req.params.serverId], (err, roles) => {
    if (err) return res.status(400).json({ error: 'Erro ao buscar cargos' });
    res.json(roles);
  });
});

app.put('/api/roles/:roleId', auth, (req, res) => {
  const { name, color } = req.body;
  db.run('UPDATE roles SET name = ?, color = ? WHERE id = ?', [name, color, req.params.roleId], (err) => {
    if (err) return res.status(400).json({ error: 'Erro ao atualizar cargo' });
    res.json({ message: 'Cargo atualizado' });
  });
});

app.delete('/api/roles/:roleId', auth, (req, res) => {
  db.run('DELETE FROM roles WHERE id = ?', [req.params.roleId], (err) => {
    if (err) return res.status(400).json({ error: 'Erro ao deletar cargo' });
    res.json({ message: 'Cargo deletado' });
  });
});

app.get('/api/members/:serverId', auth, (req, res) => {
  db.all(`SELECT sm.*, u.username, u.avatar, u.id as user_id, r.name as role_name, r.color as role_color, s.owner_id
          FROM server_members sm
          JOIN users u ON sm.user_id = u.id
          JOIN servers s ON sm.server_id = s.id
          LEFT JOIN roles r ON sm.role_id = r.id
          WHERE sm.server_id = ? AND sm.is_banned = 0`, [req.params.serverId], (err, members) => {
    if (err) {
      console.error('Erro ao buscar membros:', err);
      return res.status(400).json({ error: 'Erro ao buscar membros: ' + err.message });
    }
    res.json(members || []);
  });
});

app.put('/api/members/:memberId/role', auth, (req, res) => {
  const { role_id } = req.body;
  db.run('UPDATE server_members SET role_id = ? WHERE id = ?', [role_id, req.params.memberId], (err) => {
    if (err) return res.status(400).json({ error: 'Erro ao atualizar cargo' });
    res.json({ message: 'Cargo atualizado' });
  });
});

app.put('/api/members/:memberId/admin', auth, (req, res) => {
  const { is_admin } = req.body;
  db.run('UPDATE server_members SET is_admin = ? WHERE id = ?', [is_admin ? 1 : 0, req.params.memberId], (err) => {
    if (err) return res.status(400).json({ error: 'Erro ao atualizar admin' });
    res.json({ message: 'Status de admin atualizado' });
  });
});

app.post('/api/members/:memberId/kick', auth, (req, res) => {
  db.run('DELETE FROM server_members WHERE id = ?', [req.params.memberId], (err) => {
    if (err) return res.status(400).json({ error: 'Erro ao expulsar membro' });
    res.json({ message: 'Membro expulso' });
  });
});

app.post('/api/members/:memberId/ban', auth, (req, res) => {
  db.run('UPDATE server_members SET is_banned = 1 WHERE id = ?', [req.params.memberId], (err) => {
    if (err) return res.status(400).json({ error: 'Erro ao banir membro' });
    res.json({ message: 'Membro banido' });
  });
});

app.post('/api/friends/request', auth, (req, res) => {
  const { friend_id } = req.body;
  db.run('INSERT INTO friendships (user_id, friend_id, status) VALUES (?, ?, "pending")', [req.userId, friend_id], function(err) {
    if (err) return res.status(400).json({ error: 'Erro ao enviar solicitação' });
    res.json({ message: 'Solicitação enviada' });
  });
});

app.post('/api/friends/accept/:friendshipId', auth, (req, res) => {
  db.run('UPDATE friendships SET status = "accepted" WHERE id = ?', [req.params.friendshipId], (err) => {
    if (err) return res.status(400).json({ error: 'Erro ao aceitar solicitação' });
    res.json({ message: 'Amizade aceita' });
  });
});

app.delete('/api/friends/:friendshipId', auth, (req, res) => {
  db.run('DELETE FROM friendships WHERE id = ?', [req.params.friendshipId], (err) => {
    if (err) return res.status(400).json({ error: 'Erro ao remover amigo' });
    res.json({ message: 'Amigo removido' });
  });
});

app.get('/api/friends', auth, (req, res) => {
  db.all(`SELECT f.*, u.username, u.avatar, u.id as friend_user_id
          FROM friendships f
          JOIN users u ON (f.friend_id = u.id AND f.user_id = ?) OR (f.user_id = u.id AND f.friend_id = ?)
          WHERE (f.user_id = ? OR f.friend_id = ?) AND f.status = "accepted" AND u.id != ?`, 
    [req.userId, req.userId, req.userId, req.userId, req.userId], (err, friends) => {
    if (err) return res.status(400).json({ error: 'Erro ao buscar amigos' });
    res.json(friends);
  });
});

app.get('/api/friends/pending', auth, (req, res) => {
  db.all(`SELECT f.*, u.username, u.avatar, u.id as friend_user_id
          FROM friendships f
          JOIN users u ON f.user_id = u.id
          WHERE f.friend_id = ? AND f.status = "pending"`, [req.userId], (err, requests) => {
    if (err) return res.status(400).json({ error: 'Erro ao buscar solicitações' });
    res.json(requests);
  });
});

app.post('/api/dm', auth, (req, res) => {
  const { content, receiver_id } = req.body;
  db.run('INSERT INTO direct_messages (content, sender_id, receiver_id) VALUES (?, ?, ?)', 
    [content, req.userId, receiver_id], function(err) {
      if (err) return res.status(400).json({ error: 'Erro ao enviar mensagem' });
      res.json({ id: this.lastID, content, sender_id: req.userId, receiver_id });
    }
  );
});

app.get('/api/dm/:friendId', auth, (req, res) => {
  db.all(`SELECT dm.*, u.username, u.avatar
          FROM direct_messages dm
          JOIN users u ON dm.sender_id = u.id
          WHERE (dm.sender_id = ? AND dm.receiver_id = ?) OR (dm.sender_id = ? AND dm.receiver_id = ?)
          ORDER BY dm.created_at ASC`, 
    [req.userId, req.params.friendId, req.params.friendId, req.userId], (err, messages) => {
      if (err) return res.status(400).json({ error: 'Erro ao buscar mensagens' });
      res.json(messages);
    }
  );
});

app.get('/api/users/search', auth, (req, res) => {
  const { username } = req.query;
  db.all('SELECT id, username, avatar FROM users WHERE username LIKE ? AND id != ? LIMIT 10', 
    [`%${username}%`, req.userId], (err, users) => {
      if (err) return res.status(400).json({ error: 'Erro ao buscar usuários' });
      res.json(users);
    }
  );
});

app.post('/api/invites', auth, (req, res) => {
  const { server_id } = req.body;
  const code = Math.random().toString(36).substring(2, 10).toUpperCase();
  
  db.run('INSERT INTO server_invites (code, server_id, created_by) VALUES (?, ?, ?)', 
    [code, server_id, req.userId], function(err) {
      if (err) return res.status(400).json({ error: 'Erro ao criar convite' });
      res.json({ code, server_id });
    }
  );
});

app.get('/api/invites/:code', auth, (req, res) => {
  db.get(`SELECT i.*, s.name as server_name, s.owner_id
          FROM server_invites i
          JOIN servers s ON i.server_id = s.id
          WHERE i.code = ?`, [req.params.code], (err, invite) => {
    if (err || !invite) return res.status(404).json({ error: 'Convite não encontrado' });
    res.json(invite);
  });
});

app.post('/api/invites/:code/accept', auth, (req, res) => {
  db.get('SELECT * FROM server_invites WHERE code = ?', [req.params.code], (err, invite) => {
    if (err || !invite) return res.status(404).json({ error: 'Convite inválido' });
    
    db.get('SELECT * FROM server_members WHERE server_id = ? AND user_id = ?', 
      [invite.server_id, req.userId], (err, member) => {
        if (member) return res.status(400).json({ error: 'Você já é membro deste servidor' });
        
        db.run('INSERT INTO server_members (user_id, server_id) VALUES (?, ?)', 
          [req.userId, invite.server_id], (err) => {
            if (err) return res.status(400).json({ error: 'Erro ao entrar no servidor' });
            
            db.run('UPDATE server_invites SET uses = uses + 1 WHERE code = ?', [req.params.code]);
            res.json({ message: 'Entrou no servidor com sucesso', server_id: invite.server_id });
          }
        );
      }
    );
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n✅ AppCord servidor rodando!`);
  console.log(`🌐 Acesse: http://localhost:${PORT}`);
  console.log(`📡 API: http://localhost:${PORT}/api\n`);
});
