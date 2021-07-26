const express = require('express');
const { check } = require('express-validator');

const usersControllers = require('../controllers/users-controllers');
const fileUpload = require('../middleware/file-upload');

const router = express.Router();

router.get('/', usersControllers.getUsers);

router.post(
    '/signup',
    fileUpload.single('image'),
    [
        check('name')
            .not()
            .isEmpty(),
        check('email')
            .normalizeEmail() // Test@test.com => test@test.com
            .isEmail(),
        check('password')
            .isLength({ min: 6 })
    ], 
    usersControllers.signup
);
router.post('/login', usersControllers.login);

// router.patch('/:pid', usersControllers.updatePlace);
// router.delete('/:pid', usersControllers.deletePlace);

module.exports = router;