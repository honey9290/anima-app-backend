require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("./models/User");

const app = express();

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({
  origin: function (origin, callback) {
    const allowed = [
      process.env.FRONTEND_URL,
      "http://localhost:3000"
    ].filter(Boolean);
    if (!origin || allowed.some(u => origin.startsWith(u.replace(/\/$/, '')))) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true
}));
app.use(express.json());

// ── Connect to MongoDB ────────────────────────────────────────────────────────
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB connection failed:", err.message));

// ── Animal Names Pool (200 unique animals) ───────────────────────────────────
const ANIMALS = [
  "Aardvark", "Albatross", "Alligator", "Alpaca", "Axolotl", "Baboon", "Badger", "Barracuda", "Bat", "Bear",
  "Beaver", "Bison", "Boa", "Buffalo", "Bullfrog", "Camel", "Capybara", "Caracal", "Cassowary", "Cheetah",
  "Chinchilla", "Chipmunk", "Cobra", "Condor", "Coyote", "Crane", "Crocodile", "Dingo", "Dolphin", "Donkey",
  "Dung Beetle", "Eagle", "Echidna", "Elephant", "Emu", "Falcon", "Ferret", "Flamingo", "Fox", "Gazelle",
  "Gecko", "Giraffe", "Gnu", "Gorilla", "Groundhog", "Hammerhead", "Hamster", "Hedgehog", "Hippopotamus",
  "Hornbill", "Hyena", "Ibis", "Iguana", "Impala", "Jackal", "Jaguar", "Jellyfish", "Kangaroo", "Kiwi",
  "Koala", "Komodo Dragon", "Kookaburra", "Lemur", "Leopard", "Llama", "Lobster", "Lynx", "Manatee",
  "Mandrill", "Mantis", "Meerkat", "Mongoose", "Monitor Lizard", "Moose", "Narwhal", "Newt", "Numbat",
  "Ocelot", "Octopus", "Okapi", "Opossum", "Orangutan", "Oryx", "Ostrich", "Otter", "Owl", "Pangolin",
  "Parrot", "Peacock", "Pelican", "Penguin", "Pika", "Piranha", "Platypus", "Polar Bear", "Porcupine",
  "Prairie Dog", "Puffin", "Quokka", "Quoll", "Rabbit", "Raccoon", "Raven", "Red Panda", "Rhino", "Roadrunner",
  "Salamander", "Seahorse", "Serval", "Skunk", "Sloth", "Snow Leopard", "Snowy Owl", "Sparrowhawk", "Squid",
  "Squirrel", "Stingray", "Stoat", "Sun Bear", "Tapir", "Tasmanian Devil", "Toucan", "Tuna", "Turkey",
  "Turtle", "Uakari", "Uguisu", "Umbrellabird", "Vampire Bat", "Vicuna", "Viper", "Wallaby", "Walrus",
  "Warthog", "Weasel", "Wolf", "Wolverine", "Wombat", "Woodpecker", "Yak", "Zebra", "Zebu", "Zorilla",
  "Blue Jay", "Bull Shark", "Catfish", "Chinstrap Penguin", "Clown Fish", "Coconut Crab", "Colobus",
  "Dhole", "Diamondback", "Dragonfly", "Dung Beetle", "Electric Eel", "Fiddler Crab", "Fire Ant",
  "Flying Fox", "Fossa", "Frilled Lizard", "Giant Otter", "Gila Monster", "Glass Frog", "Golden Eagle",
  "Goliath Beetle", "Grizzly Bear", "Harp Seal", "Harpy Eagle", "Horseshoe Crab", "Hummingbird",
  "King Cobra", "Kinkajou", "Liger", "Long-Tailed Tit", "Macaw", "Manta Ray", "Margay", "Markhor",
  "Moon Bear", "Mudskipper", "Musk Ox", "Naked Mole Rat", "Night Heron", "Nile Crocodile", "Nilgai",
  "Oarfish", "Olm", "Onager", "Orinoco Crocodile", "Painted Dog", "Patas Monkey", "Patagonian Mara",
  "Proboscis Monkey", "Pronghorn", "Pygmy Hippo", "Quetzal", "Rainbow Lorikeet", "Red Kite", "Roughy",
  "Ruffed Lemur", "Rusty Spotted Cat", "Sand Cat", "Saola", "Scarlet Macaw", "Secretary Bird", "Shoebill",
];

// Pick a random animal not already used by another user
async function getUniqueAnimal() {
  const usedAnimals = await User.distinct("animalName");
  const available = ANIMALS.filter((a) => !usedAnimals.includes(a));
  if (available.length === 0) {
    // All animals taken — generate a numbered variant
    const base = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
    return `${base} ${Math.floor(Math.random() * 900) + 100}`;
  }
  return available[Math.floor(Math.random() * available.length)];
}

// ── JWT Auth Middleware ───────────────────────────────────────────────────────
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1]; // "Bearer <token>"
  if (!token) return res.status(401).json({ error: "No token provided" });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

// ── Routes ────────────────────────────────────────────────────────────────────

// POST /api/register — Create new user
app.post("/api/register", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password)
      return res.status(400).json({ error: "Username and password are required" });

    if (username.length < 3)
      return res.status(400).json({ error: "Username must be at least 3 characters" });

    if (password.length < 6)
      return res.status(400).json({ error: "Password must be at least 6 characters" });

    // Check if username already exists
    const existing = await User.findOne({ username });
    if (existing)
      return res.status(409).json({ error: "Username already taken. Choose another." });

    // Hash the password (salt rounds = 10, higher = more secure but slower)
    const hashedPassword = await bcrypt.hash(password, 10);

    // Assign a unique animal name
    const animalName = await getUniqueAnimal();

    // Save user to MongoDB
    const user = await User.create({ username, password: hashedPassword, animalName });

    // Return a JWT token so user is instantly logged in after registering
    const token = jwt.sign(
      { id: user._id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      message: "Account created!",
      token,
      user: { id: user._id, username: user.username, animalName: user.animalName },
    });
  } catch (err) {
    console.error("Register error:", err.message);
    res.status(500).json({ error: "Server error. Please try again." });
  }
});

// POST /api/login — Login existing user
app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password)
      return res.status(400).json({ error: "Username and password are required" });

    // Find user by username
    const user = await User.findOne({ username });
    if (!user)
      return res.status(401).json({ error: "Invalid username or password" });

    // Compare entered password with stored hash
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch)
      return res.status(401).json({ error: "Invalid username or password" });

    // Issue a JWT token
    const token = jwt.sign(
      { id: user._id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      message: "Logged in!",
      token,
      user: { id: user._id, username: user.username, animalName: user.animalName },
    });
  } catch (err) {
    console.error("Login error:", err.message);
    res.status(500).json({ error: "Server error. Please try again." });
  }
});

// GET /api/me — Get current user's info (protected route)
app.get("/api/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/users — List all users (admin view — shows username + animal, NOT passwords)
app.get("/api/users", async (req, res) => {
  try {
    // Never return the password field — select("-password") excludes it
    const users = await User.find().select("-password").sort({ createdAt: -1 });
    res.json({ users, total: users.length });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ── Start Server ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`✅ Backend running on http://localhost:${PORT}`);
  console.log(`   POST /api/register  — Create account`);
  console.log(`   POST /api/login     — Login`);
  console.log(`   GET  /api/me        — Get current user`);
  console.log(`   GET  /api/users     — List all users`);
});