const config = require('./lib/config');
const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const session = require('express-session');
const store = require('connect-loki');
const morgan = require('morgan');
const io = new Server(server);
const path = require('path');
const PgPersistence = require('./lib/pg-persistence');

const PORT = config.PORT;
const LokiStore = store(session);

app.set('view engine', 'ejs');
app.use(morgan('common'));
app.use(express.static(__dirname + '/public'));
app.use(express.urlencoded({ extended: false }));
app.use(session({
  cookie: {
    httpOnly: true,
    maxAge: 31 * 24 * 60 * 60 * 1000, // 31 days in millseconds
    path: "/",
    secure: false,
  },
  name: "chat-application-portfolio-project",
  resave: false,
  saveUninitialized: true,
  secret: config.SECRET,
  store: new LokiStore({}),
}));

// Create a new datastore
app.use((req, res, next) => {
  res.locals.store = new PgPersistence(req.session);
  next()
});

app.use((req, res, next) => {
  res.locals.username = req.session.username;
  res.locals.signedIn = req.session.signedIn;
  next();
});

function requiresAuth(req, res, next) {
  if (!res.locals.signedIn) {
    console.log('Unauthorized');
    res.redirect(302, '/signin');
  } else {
    next();
  }
}

app.get('/', requiresAuth,
  (req, res) => {
    res.render('pages/index');
});

app.get('/signin', (req, res) => {
  res.render('pages/signin');
});

app.post('/signin', async(req, res) => {
  let username = req.body.username.trim();
  let password = req.body.password;

  let authenicated = await res.locals.store.verifyCredentials(username, password);
  if (authenicated) {
    req.session.username = username;
    req.session.signedIn = true;
    res.redirect('/');
  } else {
    res.redirect('/signin');
  }
});

app.get('/newuser', (req, res) => {
  res.render('pages/newuser');
});

app.post('/newuser', async(req, res) => {
  let username = req.body.username.trim();
  let password = req.body.password;

  let createUser = await res.locals.store.createNewUser(username, password);

  if (createUser) {
    req.session.username = username;
    req.session.signedIn = true;
    res.redirect('/');
  } else {
    res.redirect('/newuser');
  }
});

// Handle socket connections
io.on('connection', socket => {

  // Incoming message
  socket.on('incoming message', data => {
    console.log(data);
    io.emit('incoming message', data);
  });

  // Typing event
  socket.on('typing', displayName => {
    io.emit('typing', displayName);
  });
});

server.listen(PORT, () => {
  console.log(`Listening at port ${PORT}`);
});