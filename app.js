//jshint esversion:6
require('dotenv').config()
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const md5 = require("md5");
const bcrypt = require("bcrypt");
const session = require("express-session");
const passport = require("passport")
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require("passport-google-oauth20");
const findOrCreate = require("mongoose-findorcreate");

const saltRounds = 10;
// const encrypt = require("mongoose-encryption");
const app = express();

// way to access envirnoment variable
// console.log(process.env.API_KEY);

app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
    extended: true
}));

app.use(session({
    secret: "Our little secret.",
    resave:false,
    saveUninitialized:false
}));
app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb://localhost:27017/userDB",{useNewUrlParser:true});
// mongoose.set("useCreateIndex", true);
const userSchema= new mongoose.Schema({
    email: String,
    password: String,
    googleId: String,
    secret: String
});
userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);
// userSchema.plugin(encrypt,{secret:process.env.SECRET, encryptedFields: ['password']});

const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

// -> we will use passport serialize function.

// passport.serializeUser(User.serializeUser());
// passport.deserializeUser(User.deserializeUser());

passport.serializeUser(function(User, done){
    done(null, User.id);
})
passport.deserializeUser(function(id, done){
    User.findById(id, function(err, user){
        done(err, user);
    });
});
passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
  },
  function(accessToken, refreshToken, profile, cb) {
    console.log(profile);
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
        console.log(user);  
    return cb(err, user);
      
    });
  }
));

app.get("/", function(req, res){
    res.render("home");
});
app.get("/auth/google",
    passport.authenticate('google', {scope:["profile"]})
);
app.get("/auth/google/secrets",
    passport.authenticate('google',{failureRedirect:"/login"},), 
    function(req, res){
        res.redirect("/secrets");
    }
);
app.get("/submit", function(req,res){
    if(req.isAuthenticated()){
        res.render("submit");
    }else{
        res.redirect("/login");
    }
});

app.post("/submit", function(req, res){
    const submittedSecret = req.body.secret;
    User.findById(req.user.id, function(err, foundUser){
        if(err){
            console.log(err);
        }else{
            if(foundUser){
                foundUser.secret = submittedSecret;
                foundUser.save(function(){
                    res.redirect("/secrets");
                });
            }
            
        }
    })

});
app.get("/login", function(req, res){
    res.render("login");
});
app.post("/login", function(req, res){
    // User.findOne(
    //     {email: req.body.username}, function(err, foundData){
    //         if(err){
    //             console.log(err);
    //         }else{
    //             if(foundData){
    //                 bcrypt.compare(req.body.password,
    //                     foundData.password, function(err, result){
    //                         if(result){
    //                             res.render("secrets");        
    //                         }
    //                     })
    //             }
    //         }
    //     }
    //     )

    const user = new User({
        username: req.body.username,
        password: req.body.password
    });
    req.login(user, function(err){
        if(err){
            console.log(err);
        }else{
            passport.authenticate("local")(req, res, function(){
                res.redirect("/secrets");
            });
        }
    });
    }
)

app.get("/logout", function(req, res){
    req.logOut(function(err){
        if(err){
            console.log(err)
        }else{
            res.redirect("/");
        }
    });

});

app.get("/register", function(req, res){
    res.render("register");
});
app.get("/secrets", function(req, res){
    User.find({"secrets":{$ne: null}}, function(err, foundSecret){
        if(err){
            console.log(err)
        }else{
            if(foundSecret){
                res.render("secrets",{userWithSecret: foundSecret});
            }
        }
    });
    // if(req.isAuthenticated()){
    //     res.render("secrets");
    // }else{
    //     res.redirect("/login");
    // }
})
app.post("/register", function(req, res){
    // bcrypt.hash(req.body.password, saltRounds, function(err, hash){
    //     const newUser = new User({
    //     email: req.body.username,
    //     password: hash
    //     });
    //     newUser.save(function(err){
    //             if(err){
    //                 console.log(err);
    //             }else{
    //                 res.render("secrets");
    //             }   
    // })

    // });
User.register({username: req.body.username},
            req.body.password, function(err, user){
                if(err){
                    console.log(err);
                    res.redirect("/register");
                }else{
                    passport.authenticate("local")(req, res, function(){
                        res.redirect("/secrets");
                    })
                }
            })



})


app.listen(3000,function(){
    console.log("Up on 3000");
})