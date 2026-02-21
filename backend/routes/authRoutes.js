import express from 'express';
import User from '../models/User.js';
import Refrigerator from '../models/Refrigerator.js';
import generateToken from '../utils/generateToken.js';
import createRefrigeratorForUser from '../utils/createRefrigeratorForUser.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/login', async (req, res) => {
  const{ email, password } = req.body;

  // TODO: transfer this check to front-end
  if (!email || !password) {
    return res.status(400).json({
      message: "Please enter both email and password"
    });
  }

  try {
    const user = await User.findOne({ email });

    if (user && (await user.matchPassword(password))) {
      const token = generateToken(user._id);

      return res.json({
        _id: user._id,
        username: user.username,
        email: user.email,
        refrigeratorId: user.refrigeratorId,
        token: token
      })
    }

    else {
      return res.status(400).json({
      message: "Invalid email or password"
      })
    }
  } catch (error) {
      return res.status(500).json({
      message: "An error occured during login"
    });
  }
})

router.post('/signup', async (req, res) => {
  const{ username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({
      message: "Please enter all fields."
    });
  }

  try {
    const existingUsername = await User.findOne({username});
    const existingEmail = await User.findOne({email});
    if (existingUsername) {
      return res.status(400).json({message: "Username already taken."});
    } if (existingEmail) {
      return res.status(400).json({message: "Email already taken."});
    }

    // Create the user
    const newUser = new User ({username, email, password});
    await newUser.save();

    // Create a refrigerator for this user
    const newRefrigerator = new Refrigerator({
      username: username,
      userList: [newUser._id],           // will add user ID after user is created
      foodMap: {}
    });
    await newRefrigerator.save();

    // Link refrigerator to user and save again
    newUser.refrigeratorId = newRefrigerator._id;
    await newUser.save();

    return res.status(201).json({
      _id: newUser._id,
      username: newUser.username,
      email: newUser.email,
      refrigeratorId: newUser.refrigeratorId,
      token: generateToken(newUser._id),
      message: "User created successfully"
    });
  } catch (error) {
      console.error(error);
      return res.status(500).json({
        message: "An error occurred during signup."
    });
  }
  
})

router.get('/google', (req, res) => {
    const params = new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        redirect_uri: process.env.GOOGLE_CALLBACK_URL,
        response_type: 'code',
        scope: 'openid email profile',
        access_type: 'offline',
        prompt: 'consent',
    });

    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    res.redirect(googleAuthUrl);
})

router.get('/google/callback', async (req, res) => {
    const { code } = req.query;

    if (!code) {
        return res.status(400).json({ message: 'Authorization code missing' });
    }

    try {
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code,
                client_id: process.env.GOOGLE_CLIENT_ID,
                client_secret: process.env.GOOGLE_CLIENT_SECRET,
                redirect_uri: process.env.GOOGLE_CALLBACK_URL,
                grant_type: 'authorization_code'
            })
        });
    
        const tokens = await tokenResponse.json();

        if (tokens.error) {
            return res.status(400).json({ message: tokens.error_description || 'Token exchange failed' });
        }
    
        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${tokens.access_token}` }
        });
    
        const googleUser = await userInfoResponse.json();
    
        let user = await User.findOne({
            'providers.provider': 'google',
            'providers.providerId': googleUser.id
        });
    
        if (!user) {
            user = await User.findOne({
                email: googleUser.email
            });
    
            if (user) {
                user.providers.push({
                    provider: 'google',
                    providerId: googleUser.id
                });
                await user.save();
            } else {
                user = new User({
                    email: googleUser.email,
                    username: googleUser.name.replace(/\s+/g, '_').toLowerCase(),
                    providers: [{
                        provider: 'google',
                        providerId: googleUser.id
                    }]
                });
                await user.save();

                await createRefrigeratorForUser(user);
            }
        }
    
        const token = generateToken(user._id);
        return res.redirect(`http://localhost:5173/auth/callback?token=${token}`);
    } catch (error) {
        console.error('Google OAuth error:', error);
        return res.status(500).json({
            message: 'OAuth failed'
        });
    }
})

router.get('/me', protect, async (req, res) => {
  return res.json(req.user);
})


export default router;