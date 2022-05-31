require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const passportLocalMongoose = require("passport-local-mongoose");
const passport = require("passport");
const session = require("express-session");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const findOrCreate = require("mongoose-findorcreate");
const _ = require("lodash");

const app = express();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static("public"));
app.set("view engine", "ejs");

app.use(
  session({
    secret: process.env.MONGOOSE_LINK,
    resave: false,
    saveUninitialized: false,
  })
);

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect(process.env.MONGOOSE_LINK);

const userSchema = new mongoose.Schema({
  message: String,
  password: String,
  googleId: String,
});

userSchema.plugin(findOrCreate);
userSchema.plugin(passportLocalMongoose);

const User = mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  User.findById(id, (err, user) => {
    done(err, user);
  });
});

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "https://turps.herokuapp.com/auth/google/chat",
    },
    function (accessToken, refreshToken, profile, cb) {
      User.findOrCreate({ googleId: profile.id }, function (err, user) {
        return cb(err, user);
      });
    }
  )
);

const messageSchema = {
  usernameOfUser: String,
  messageOfUser: String,
};

const Message = mongoose.model("message", messageSchema);

app.get("/", (req, res) => {
  if (req.isAuthenticated()) {
    res.redirect("/chat");
  } else {
    res.render("home");
  }
});

app.get("/register", (req, res) => {
  res.render("register");
});

app.get("/login", (req, res) => {
  res.render("login");
});

app.get("/chat", (req, res) => {
  if (req.isAuthenticated()) {
    Message.find({}, (err, messageFound) => {
      if (!err) {
        res.render("chat", {
          messages: messageFound,
          username: req.user.username,
        });
      } else {
        console.log(err);
      }
    });
  } else {
    res.redirect("/");
  }
});

app.post("/chat", (req, res) => {
  const userMessageSent = req.body.message;

  const UserMessage = new Message({
    usernameOfUser: req.body.send,
    messageOfUser: userMessageSent,
  });

  UserMessage.save((err) => {
    res.redirect("/chat");
  });
});

app.post("/clear", (req, res) => {
  Message.deleteMany({ __v: 0 }, (err) => {
    if (!err) {
      User.deleteMany({ __v: 0 }, (err) => {
        if (!err) {
          res.redirect("/chat");
        } else {
          res.send(err);
        }
      });
    } else {
      res.send(err);
    }
  });
});

app.post("/register", (req, res) => {
  User.register(
    { username: req.body.username },
    req.body.password,
    (err, user) => {
      if (err) {
        User.findOne({ username: req.body.username }, (err, userFound) => {
          if (userFound) {
            res.send(
              "This user already exists. Please log in if you own this account."
            );
          }
        });
      } else {
        passport.authenticate("local")(req, res, () => {
          res.redirect("/chat");
        });
      }
    }
  );
});

app.post("/login", (req, res) => {
  const user = new User({
    username: req.body.username,
    password: req.body.password,
  });

  req.login(user, (err) => {
    if (err) {
      res.redirect("/login");
    } else {
      passport.authenticate("local")(req, res, () => {
        res.redirect("/chat");
      });
    }
  });
});

app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile"] })
);

app.get(
  "/auth/google/chat",
  passport.authenticate("google", { failureRedirect: "/login" }),
  (req, res) => {
    res.redirect("/chat");
  }
);

app.get("/logout", (req, res) => {
  req.logout();
  res.redirect("/");
});

let PORT = process.env.PORT;
if (PORT == null || PORT == "") {
  PORT = 3000;
}
app.listen(PORT, console.log("Server started on port 3000."));
