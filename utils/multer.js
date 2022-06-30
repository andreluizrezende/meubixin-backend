const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.resolve(__dirname, "..", "uploads"));
  },
  filename: (req, file, cb) => {
    console.log(file.mimetype);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname)
  },
});

const fileFilter = (req, file, cb) => {
  const extension = ['image/png', 'image/jpg', 'image/jpeg'].find(format => format == file.mimetype);
  if (extension) return cb(null, true);
  return cb(null, false);
}

const upload = multer({ storage, fileFilter });
module.exports = upload;