const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();

// =============================
// MIDDLEWARE
// =============================
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true })); // IMPORTANT for form

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// =============================
// MYSQL CONNECTION
// =============================
const db = mysql.createConnection({
  host: 'mydb',          // must match docker-compose service name
  user: 'root',
  password: 'rootpassword',
  database: 'contactdb'
});

db.connect((err) => {
  if (err) {
    console.error('Database connection failed:', err);
    return;
  }
  console.log('Connected to MySQL');
});

// =============================
// CREATE TABLES
// =============================
db.query(`
  CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    password VARCHAR(100) NOT NULL
  )
`);

db.query(`
  CREATE TABLE IF NOT EXISTS user_services (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    username VARCHAR(50) NOT NULL,
    service_type VARCHAR(100) NOT NULL,
    amount DECIMAL(10,2),
    recipient VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`);

// =============================
// DASHBOARD PAGE
// =============================
app.get('/dashboard', (req, res) => {
  db.query("SELECT * FROM user_services ORDER BY created_at DESC", (err, results) => {
    if (err) {
      console.error(err);
      return res.send("Error loading dashboard");
    }
    res.render('dashboard', { services: results });
  });
});

// =============================
// REGISTER USER
// =============================
app.post('/register', (req, res) => {
  const { username, password } = req.body;

  db.query(
    "INSERT INTO users (username, password) VALUES (?, ?)",
    [username, password],
    (err, result) => {
      if (err) return res.send("Error registering user");
      res.redirect('/dashboard');
    }
  );
});

// =============================
// ADD SERVICE
// =============================
app.post('/add-service', (req, res) => {
  const { userId, serviceType, amount, recipient } = req.body;

  db.query(
    "SELECT username FROM users WHERE id = ?",
    [userId],
    (err, result) => {
      if (err || result.length === 0) {
        return res.send("User not found");
      }

      const username = result[0].username;

      db.query(
        `INSERT INTO user_services 
        (user_id, username, service_type, amount, recipient) 
        VALUES (?, ?, ?, ?, ?)`,
        [userId, username, serviceType, amount, recipient],
        (err) => {
          if (err) return res.send("Error adding service");
          res.redirect('/dashboard');
        }
      );
    }
  );
});

// =============================
// DEFAULT ROUTE
// =============================
app.get('/', (req, res) => {
  res.redirect('/dashboard');
});

// =============================
app.listen(5000, () => {
  console.log("Server running on port 5000");
});
