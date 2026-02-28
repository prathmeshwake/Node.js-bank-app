const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// MySQL Connection
const db = mysql.createConnection({
  host: 'mydb',   // docker service name
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
// CREATE TABLES (IF NOT EXISTS)
// =============================

// Users Table
db.query(`
  CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    password VARCHAR(100) NOT NULL
  )
`);


// User Services Table (WITH username column)
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
// REGISTER USER
// =============================
app.post('/register', (req, res) => {
  const { username, password } = req.body;

  db.query(
    "INSERT INTO users (username, password) VALUES (?, ?)",
    [username, password],
    (err, result) => {
      if (err) return res.status(500).json(err);
      res.json({ message: "User registered successfully" });
    }
  );
});


// =============================
// ADD SERVICE
// =============================
app.post('/add-service', (req, res) => {
  const { userId, serviceType, amount, recipient } = req.body;

  // Get username using userId
  db.query(
    "SELECT username FROM users WHERE id = ?",
    [userId],
    (err, result) => {
      if (err) return res.status(500).json(err);
      if (result.length === 0)
        return res.status(404).json({ message: "User not found" });

      const username = result[0].username;

      // Insert into user_services with username
      db.query(
        `INSERT INTO user_services 
        (user_id, username, service_type, amount, recipient) 
        VALUES (?, ?, ?, ?, ?)`,
        [userId, username, serviceType, amount, recipient],
        (err, result) => {
          if (err) return res.status(500).json(err);
          res.json({ message: "Service added successfully" });
        }
      );
    }
  );
});


// =============================
// GET ALL SERVICES
// =============================
app.get('/services', (req, res) => {
  db.query(
    "SELECT * FROM user_services",
    (err, result) => {
      if (err) return res.status(500).json(err);
      res.json(result);
    }
  );
});


app.listen(5000, () => {
  console.log("Server running on port 5000");
});
