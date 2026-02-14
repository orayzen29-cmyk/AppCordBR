const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'appcord.db'));

console.log('Corrigindo banco de dados...');

// Adicionar donos como membros em servidores que não têm membros
db.all('SELECT id, owner_id FROM servers', [], (err, servers) => {
  if (err) {
    console.error('Erro ao buscar servidores:', err);
    return;
  }
  
  console.log(`Encontrados ${servers.length} servidores`);
  
  servers.forEach(server => {
    // Verificar se o dono já é membro
    db.get('SELECT * FROM server_members WHERE server_id = ? AND user_id = ?', 
      [server.id, server.owner_id], 
      (err, member) => {
        if (err) {
          console.error(`Erro ao verificar membro do servidor ${server.id}:`, err);
          return;
        }
        
        if (!member) {
          // Adicionar dono como membro
          db.run('INSERT INTO server_members (user_id, server_id, is_admin) VALUES (?, ?, 1)', 
            [server.owner_id, server.id], 
            (err) => {
              if (err) {
                console.error(`Erro ao adicionar dono ao servidor ${server.id}:`, err);
              } else {
                console.log(`✓ Dono adicionado ao servidor ${server.id}`);
              }
            }
          );
        } else {
          console.log(`- Servidor ${server.id} já tem o dono como membro`);
        }
      }
    );
  });
  
  setTimeout(() => {
    console.log('\nCorreção concluída!');
    db.close();
  }, 2000);
});
