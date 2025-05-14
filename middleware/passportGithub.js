const passport = require('passport');
const GitHubStrategy = require('passport-github2').Strategy;
const User = require('../models/User');
console.log('GitHub client ID:', process.env.GITHUB_CLIENT_ID);
console.log('GitHub client secret:', process.env.GITHUB_CLIENT_SECRET);

require('./middleware/passportGithub');


passport.serializeUser((user, done) => {
  done(null, user.id);
});
passport.deserializeUser(async (id, done) => {
  const user = await User.findById(id);
  done(null, user);
});

passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: '/api/auth/github/callback',
    scope: ['user:email']
  },
  async (accessToken, refreshToken, profile, done) => {
    const email = profile.emails[0].value;
    let user = await User.findOne({ email });

    if (!user) {
      user = await User.create({
        name: profile.displayName || profile.username,
        email,
        password: 'github-oauth',
        avatar: profile.photos?.[0]?.value || '',
        status: 'active'
      });
    }

    return done(null, user);
  }
));
