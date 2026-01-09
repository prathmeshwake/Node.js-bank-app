const express = require("express");
const mysql = require("mysql2");
const session = require("express-session");
const bodyParser = require("body-parser");
const path = require("path");

const app = express();

/**
 * OpenShift REQUIRED
 */
const PORT = process.env.PORT || 8080;
const HOST = "0.0.0.0";

/**
 * Middleware
 */
app.set("trust proxy", 1); // IMPORTANT for OpenShift

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(
  session({
    name: "bank-session",
    secret: process.env.SESSION_SECRET || "banksecret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // set true only if HTTPS end-to-end
      httpOnly: true,
    },
  })
);

/**
 * View Engine
 */
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

/**
 * MySQL Pool (Recommended for OpenShift)
 */
const db = mysql.createPool({
  host: process.env.DB_HOST || "mysql",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "root123",
  database: process.env.DB_NAME || "testdb",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

/**
 * Initialize DB with retry
 */
function initDB(retries = 10) {
  db.getConnection((err, connection) => {
    if (err) {
      console.error("❌ MySQL connection failed:", err.message);
      if (retries > 0) {
        console.log(`🔁 Retrying DB connection (${retries} left)...`);
        setTimeout(() => initDB(retries - 1), 5000);
      } else {
        console.error("❌ Could not connect to MySQL. Exiting.");
        process.exit(1);
      }
      return;
    }

    console.log("✅ Connected to MySQL");

    connection.query(
      `CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL
      )`,
      (err) => {
        connection.release();
        if (err) {
          console.error("❌ Table creation failed:", err.message);
        } else {
          console.log("✅ Users table ready");
        }
      }
    );
  });
}

initDB();

/**
 * Routes
 */

// Root
app.get("/", (req, res) => res.redirect("/login"));

// Signup
app.get("/signup", (req, res) => {
  res.render("signup", { message: "" });
});

app.post("/signup", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.render("signup", { message: "All fields required" });
  }

  const sql = "INSERT INTO users (username, password) VALUES (?, ?)";

  db.query(sql, [username, password], (err) => {
    if (err) {
      console.error(err.message);
      return res.render("signup", {
        message: "User already exists or DB error",
      });
    }
    res.redirect("/login");
  });
});

// Login
app.get("/login", (req, res) => {
  res.render("login", { message: "" });
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.render("login", { message: "All fields required" });
  }

  const sql = "SELECT * FROM users WHERE username = ? AND password = ?";

  db.query(sql, [username, password], (err, results) => {
    if (err) {
      console.error(err.message);
      return res.render("login", { message: "Database error" });
    }

    if (results.length > 0) {
      req.session.user = {
        id: results[0].id,
        username: results[0].username,
      };
      res.redirect("/dashboard");
    } else {
      res.render("login", { message: "Invalid credentials" });
    }
  });
});

// Dashboard
app.get("/dashboard", (req, res) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }
  res.render("dashboard", { user: req.session.user });
});

// Logout
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});

/**
 * Start Server
 */
app.listen(PORT, HOST, () => {
  console.log(`🚀 Server running on ${HOST}:${PORT}`);
});
