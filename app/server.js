const express = require("express");
const mysql = require("mysql2");
const session = require("express-session");
const bodyParser = require("body-parser");
const path = require("path");

const app = express();
const PORT = 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: "banksecret",
  resave: false,
  saveUninitialized: true,
}));

// Use EJS templates from views folder
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// MySQL connection
const db = mysql.createConnection({
  host: process.env.DB_HOST || "db",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "root123",
  database: process.env.DB_NAME || "testdb",
});

// Retry logic for MySQL connection
function connectWithRetry() {
  db.connect((err) => {
    if (err) {
      console.log("DB connection failed, retrying in 5s...", err.message);
      setTimeout(connectWithRetry, 5000);
    } else {
      console.log("Connected to MySQL");

      // Ensure users table exists
      db.query(`CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL
      )`);
    }
  });
}

connectWithRetry();

// Routes

// Redirect root to login
app.get("/", (req, res) => res.redirect("/login"));

// Signup page
app.get("/signup", (req, res) => res.render("signup", { message: "" }));

app.post("/signup", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.render("signup", { message: "All fields required" });
  }

  const query = "INSERT INTO users (username, password) VALUES (?, ?)";
  db.query(query, [username, password], (err, result) => {
    if (err) {
      console.error(err);
      return res.render("signup", { message: "User already exists or DB error" });
    }
    res.redirect("/login"); // Redirect to login after signup
  });
});

// Login page
app.get("/login", (req, res) => res.render("login", { message: "" }));

app.post("/login", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.render("login", { message: "All fields required" });
  }

  const query = "SELECT * FROM users WHERE username = ? AND password = ?";
  db.query(query, [username, password], (err, results) => {
    if (err) throw err;

    if (results.length > 0) {
      req.session.user = results[0];
      res.redirect("/dashboard");
    } else {
      res.render("login", { message: "Invalid credentials" });
    }
  });
});

// Dashboard
app.get("/dashboard", (req, res) => {
  if (!req.session.user) return res.redirect("/login");
  res.render("dashboard", { user: req.session.user });
});

// Logout
app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/login");
});

// Start server
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));

