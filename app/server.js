const express = require("express");
const mysql = require("mysql2");
const session = require("express-session");
const bodyParser = require("body-parser");
const path = require("path");

const app = express();

// PORT / HOST
const PORT = process.env.PORT || 8080;
const HOST = "0.0.0.0";

// Middleware
app.set("trust proxy", 1);
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(
  session({
    name: "bank-session",
    secret: process.env.SESSION_SECRET || "banksecret",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, httpOnly: true }
  })
);

// View Engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// MySQL Pool
const db = mysql.createPool({
  host: process.env.DB_HOST || "mysql",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "root123",
  database: process.env.DB_NAME || "testdb",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Initialize DB
function initDB(retries = 10) {
  db.getConnection((err, connection) => {
    if (err) {
      console.error("❌ MySQL connection failed:", err.message);
      if (retries > 0) setTimeout(() => initDB(retries - 1), 5000);
      else process.exit(1);
      return;
    }
    console.log("✅ Connected to MySQL");

    // Users table
    connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL
      );`
    );

    // User services table
    connection.query(`
      CREATE TABLE IF NOT EXISTS user_services (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        service_type VARCHAR(50) NOT NULL,
        amount DECIMAL(10,2),
        recipient VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );`,
      () => connection.release()
    );
  });
}

initDB();

// Routes
app.get("/", (req, res) => res.redirect("/login"));

// Signup
app.get("/signup", (req, res) => res.render("signup", { message: "" }));
app.post("/signup", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.render("signup", { message: "All fields required" });

  db.query("INSERT INTO users (username, password) VALUES (?, ?)", [username, password], (err) => {
    if (err) return res.render("signup", { message: "User exists or DB error" });
    res.redirect("/login");
  });
});

// Login
app.get("/login", (req, res) => res.render("login", { message: "" }));
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.render("login", { message: "All fields required" });

  db.query("SELECT * FROM users WHERE username = ? AND password = ?", [username, password], (err, results) => {
    if (err) return res.render("login", { message: "DB error" });
    if (!results.length) return res.render("login", { message: "Invalid credentials" });

    req.session.user = { id: results[0].id, username: results[0].username };
    res.redirect("/dashboard");
  });
});

// Dashboard
app.get("/dashboard", (req, res) => {
  if (!req.session.user) return res.redirect("/login");
  res.render("dashboard", { user: req.session.user });
});

// Logout
app.get("/logout", (req, res) => req.session.destroy(() => res.redirect("/login")));

// Service endpoints
app.post("/service", (req, res) => {
  const { userId, serviceType, amount, recipient } = req.body;
  db.query(
    "INSERT INTO user_services (user_id, service_type, amount, recipient) VALUES (?, ?, ?, ?)",
    [userId, serviceType, amount || 0, recipient || null],
    (err) => {
      if (err) return res.json({ success: false, error: err.message });
      res.json({ success: true });
    }
  );
});

app.get("/services/:userId", (req, res) => {
  db.query("SELECT * FROM user_services WHERE user_id = ?", [req.params.userId], (err, results) => {
    if (err) return res.json({ error: err.message });
    res.json(results);
  });
});

// Start server
app.listen(PORT, HOST, () => console.log(`🚀 Server running on ${HOST}:${PORT}`));
