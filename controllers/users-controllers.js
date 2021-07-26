const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const User = require('../models/user');
const HttpError = require('../models/http-error');

exports.getUsers = async (req, res, next) => {
    let users;
    try {
        users = await User.find({}, '-password');
    } catch (err) {
        return next(new HttpError('Fetching users failed, please try again later', 500));
    }
 
    res.json({ users: users.map(u => u.toObject({ getters: true })) });
};

exports.signup = async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return next(new HttpError('Invalid inputs, please check your inputs', 422));
    }

    const { name, email, password } = req.body;

    let existingUser;

    try {
        existingUser = await User.findOne({ email });
    } catch (err) {
        return next(new HttpError('Signup failed please tray again', 500));
    }

    if (existingUser) {
         return next(new HttpError('This email has already been taken!!', 422));
    }

    let hashedPassword;
    try {
         hashedPassword = await bcrypt.hash(password, 12);
    } catch (err) {
        return next(new HttpError('COuld not create user, please try again!', 500));
    }

    const createdUser = new User({
        name,
        email,
        password: hashedPassword,
        image: req.file.path,
        places: []
    });

    try {
        await createdUser.save();
    } catch (err) {
        return next(new HttpError('Signup failed, please try again.', 500));
    }

    let token;
    try {
        token = jwt.sign(
            { 
                userId: createdUser.id,
                email: createdUser.email 
            },
            process.env.JWT_KEY,
            { expiresIn: '77d' }
        );
    } catch (err) {
        return next(new HttpError('Signup failed, please try again.', 500));
    }

    res.status(201).json({ 
        userId: createdUser.id,
        email: createdUser.email,
        token
     });
};

exports.login = async (req, res, next) => {
    const { email, password } = req.body;
    
    let existingUser;

    try {
        existingUser = await User.findOne({ email });
    } catch (err) {
        return next(new HttpError('Signup failed please tray again', 500));
    }

    if (!existingUser) {
        return next(new HttpError('Could not identify the user, credentials seem to be wrong.', 401));
    }

    let isValidPassword = false;
    try {
        isValidPassword = await bcrypt.compare(password, existingUser.password);
    } catch (err) {
        return next(new HttpError('Could not log you in, please check your email & password and try again.', 401));
    }

    if (!isValidPassword) {
        return next(new HttpError('Invalid credentials, could not log you in.', 401));
    }

    let token;
    try {
        token = jwt.sign(
            { 
                userId: existingUser.id,
                email: existingUser.email 
            },
            process.env.JWT_KEY,
            { expiresIn: '77d' }
        );
    } catch (err) {
        return next(new HttpError('Signup failed, please try again.', 500));
    }
    
    res.json({ 
        userId: existingUser.id,
        email: existingUser.email,
        token
    });
};

