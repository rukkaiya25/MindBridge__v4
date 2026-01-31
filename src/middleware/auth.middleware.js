const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'mindbridge_secret_key';

module.exports = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({ message: 'Token missing' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.userId = decoded.id;
        next();
    } catch (err) {
        return res.status(401).json({ message: err.name === 'TokenExpiredError' ? 'Session expired' : 'Invalid token' });
    }
};
