const authorizeRole = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: 'Akses ditolak. Silakan login terlebih dahulu.' });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Akses ditolak. Anda tidak memiliki izin.' });
        }

        next();
    };
};

module.exports = authorizeRole;