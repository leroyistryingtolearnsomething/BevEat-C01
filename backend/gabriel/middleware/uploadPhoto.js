// Reads ONE uploaded photo from a multipart/form-data request (field name "photo").
// After this runs:  req.file = { buffer, mimetype, size, ... }   and   req.body = the other form fields (as text)
const multer = require("multer");

const upload = multer({
  storage: multer.memoryStorage(),        // keep the file in memory (req.file.buffer), we send it straight to Storage
  limits: { fileSize: 4 * 1024 * 1024 },  // 4 MB max (the page shrinks photos to ~200 KB; Vercel's limit is 4.5 MB)
  fileFilter: (req, file, cb) => cb(null, file.mimetype.startsWith("image/")), // only images, anything else is ignored
}).single("photo");

// wrap multer so its errors become a 400 with a kid-friendly message, not a 500
function uploadPhoto(req, res, next) {
  upload(req, res, (err) => {
    if (err) {
      const msg = err.code === "LIMIT_FILE_SIZE" ? "That photo is too big. Try another one." : "Couldn't read that photo.";
      return res.status(400).json({ error: msg });
    }
    next();
  });
}

module.exports = uploadPhoto;
