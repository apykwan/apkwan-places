const fs = require('fs');
const mongoose = require('mongoose');
const { v4: uuid } = require('uuid');
const { validationResult } = require('express-validator');

const HttpError = require('../models/http-error');
const getCoordsForAddress = require('../util/location');
const Place = require('../models/place');
const User = require('../models/user');

exports.getPlaceById = async(req, res, next) => {
    const placeId = req.params.pid;

    let place;
    try {
        place = await Place.findById(placeId);
    } catch (err) {
        return next(new HttpError('Oops, something went wrong.', 500));
    }
    

    if (!place) {
        // const error = new Error('Could not find a place for the provided id.');
        // error.code = 404;
        // throw error;
        throw new HttpError('Could not find a place for the provided id.', 404);
    }

    res.status(200).json({
        place: place.toObject({ getters: true })
    });
};

exports.getPlacesByUserId = async (req, res, next) => {
    const userId = req.params.uid;

    // let places;
    let userWithPlaces; 
    try {
        // places = await Place.find({ creator: userId });
        userWithPlaces = await User.findById(userId).populate('places');
    } catch (err) {
        return next(new HttpError('Oops, something went wrong.', 500));
    }

    // if (!places || places.length === 0)
    if (!userWithPlaces || userWithPlaces.places.length === 0) {
        // const error = new Error('Could not find a place for the provided user id.');
        // error.code = 404;
        // return next(error);
        return next(new HttpError('Could not find a places for the provided user id.', 404));
    }

    res.json({ 
        places: userWithPlaces.places.map(p => p.toObject({ getters: true })) 
    });
};

exports.createPlace = async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return next(new HttpError('Invalid inputs, please check your data', 422));
    }

    const { title, description, address } = req.body;

    let coordinates;
    try {
        coordinates = await getCoordsForAddress(address);
    } catch (error) {
        return next(error);
    }

    const createdPlace = new Place({
        title,
        description,
        address,
        location: coordinates,
        image: req.file.path,
        creator: req.userData.userId
    });

    let user;

    try {
        user = await User.findById(req.userData.userId);
    } catch (err) {
        return next(new HttpError('Creating place failed, please check your data', 500));
    }

    if (!user) {
        return next(new HttpError('Could not find user for provided id', 404));
    }

    try {
        const sess = await mongoose.startSession();
        sess.startTransaction();
        await createdPlace.save({ session: sess });
        user.places.push(createdPlace);
        await user.save({ session: sess });
        await sess.commitTransaction();
    } catch (err) {
        return next(new HttpError('Createing place failed, please try again.', 500));
    }

    res.status(201).json({ place: createdPlace.toObject({ getters: true }) });
};

exports.updatePlace = async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return next(new HttpError('Invalid inputs, please check your data', 422));
    }

    const { title, description } = req.body;
    const placeId = req.params.pid;

    let place;
    try {
        place = await Place.findById(placeId);
    } catch (err) {
        return next(new HttpError('Oops, Something just went wrong. Please try again.', 500));
    }

    if (place.creator.toString() !== req.userData.userId) {
        return next(new HttpError('You are not allowed to edit this place.', 401));
    }
    
    place.title = title;
    place.description = description;

    try {
        await place.save();
    } catch (err) {
        return next(new HttpError('Oops, Something just went wrong. Updated Failed', 500));
    }

    res.status(200).json({ 
        place: place.toObject({ getters: true }) 
    });
};

exports.deletePlace = async (req, res, next) => {
    const placeId = req.params.pid;

    let place;
    try {
        place = await Place.findById(placeId).populate('creator');
    } catch (err) {
        return next(new HttpError('Oops, Something just went wrong. Updated Failed', 500));
    }

    if (!place) {
        return next(new HttpError('Could not find place of this Id', 404));
    }

    if (place.creator._id.toString() !== req.userData.userId) {
        return next(new HttpError('You are not allowed to edit this place.', 403));
    }

    const imagePath = place.image;

    try {
        const sess = await mongoose.startSession();
        sess.startTransaction();
        await place.remove({ session: sess });
        place.creator.places.pull(place);
        await place.creator.save({ session: sess });
        await sess.commitTransaction();
    } catch (err) {
        return next(new HttpError('Oops, Something just went wrong. Updated Failed', 500));
    }

    fs.unlink(imagePath, err => {
        console.log(err);
    });

    res.status(200).json({ message: 'Deleted place!' });
};