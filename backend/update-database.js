const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'appcord.db'));

console.log('Atualizando estrutura do banco de dados...');

// Adicionar colunas que podem estar faltando
db.serialize(() => {
  // Tentar adicionar is_admin
  db.run('ALTER TABLE server_members ADD COLUMN is_admin INTEGER DEFAULT 0', (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Erro ao adicionar is_admin:', err.message);
    } else {
      console.log('✓ Coluna is_admin verificada');
    }
  });
  
  // Tentar adicionar is_banned
  db.run('ALTER TABLE server_members ADD COLUMN is_banned INTEGER DEFAULT 0', (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Erro ao adicionar is_banned:', err.message);
    } else {
      console.log('✓ Coluna is_banned verificada');
    }
  });
  
  // Tentar adicionar banner e bio em users
  db.run('ALTER TABLE users ADD COLUMN banner TEXT DEFAULT NULL', (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Erro ao adicionar banner:', err.message);
    } else {
      console.log('✓ Coluna banner verificada');
    }
  });
  
  db.run('ALTER TABLE users ADD COLUMN bio TEXT DEFAULT NULL', (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Erro ao adicionar bio:', err.message);
    } else {
      console.log('✓ Coluna bio verificada');
    }
  });
  
  setTimeout(() => {
    // Agora adicionar donos como membros
    db.all('SELECT id, owner_id FROM servers', [], (err, servers) => {
      if (err) {
        console.error('Erro ao buscar servidores:', err);
        db.close();
        return;
      }
      
      console.log(`\nEncontrados ${servers.length} servidores`);
      
      let processed = 0;
      servers.forEach(server => {
        db.get('SELECT * FROM server_members WHERE server_id = ? AND user_id = ?', 
          [server.id, server.owner_id], 
          (err, member) => {
            if (!member) {
              db.run('INSERT INTO server_members (user_id, server_id, is_admin) VALUES (?, ?, 1)', 
                [server.owner_id, server.id], 
                (err) => {
                  if (err) {
                    console.error(`Erro ao adicionar dono ao servidor ${server.id}:`, err.message);
                  } else {
                    console.log(`✓ Dono adicionado ao servidor ${server.id}`);
                  }
                  processed++;
                  if (processed === servers.length) {
                    console.log('\n✓ Atualização concluída!');
                    db.close();
                  }
                }
              );
            } else {
              console.log(`- Servidor ${server.id} já tem o dono como membro`);
              processed++;
              if (processed === servers.length) {
                console.log('\n✓ Atualização concluída!');
                db.close();
              }
            }
          }
        );
      });
    });
  }, 1000);
});
