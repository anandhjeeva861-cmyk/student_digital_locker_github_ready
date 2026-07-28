const express = require("express");
const path = require("path");
const db = require("../db");
const { authRequired } = require("../middleware/auth");

const router = express.Router();
const uploadRoot = path.resolve(process.env.UPLOAD_DIR || "server/uploads");

router.get("/:filePath", authRequired, (req, res, next) => {
  try {
    const filePath = decodeURIComponent(req.params.filePath);
    const fullPath = path.resolve(uploadRoot, filePath);
    if (!fullPath.startsWith(uploadRoot)) {
      const error = new Error("Invalid file path.");
      error.status = 400;
      throw error;
    }

    const document = db.prepare("SELECT * FROM documents WHERE file_path = ?").get(filePath);
    const ownerPhoto = db.prepare("SELECT * FROM profiles WHERE photo_path = ?").get(filePath);

    const canReadDocument = document && (
      document.owner_id === req.user.id ||
      (
        req.user.role === "teacher" &&
        document.category === "academic" &&
        document.department_key === req.user.department_key &&
        document.year === req.user.year
      )
    );
    const canReadPhoto = ownerPhoto && ownerPhoto.id === req.user.id;

    if (!canReadDocument && !canReadPhoto) {
      const error = new Error("File not found.");
      error.status = 404;
      throw error;
    }

    res.sendFile(fullPath);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
