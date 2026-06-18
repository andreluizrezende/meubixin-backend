const multer = require('multer');

const fileFilter = (req, file, cb) => {
  const allowed = ['image/png', 'image/jpg', 'image/jpeg'];
  if (allowed.includes(file.mimetype)) return cb(null, true);
  return cb(null, false);
}

const upload = multer({ storage: multer.memoryStorage(), fileFilter });
module.exports = upload;
