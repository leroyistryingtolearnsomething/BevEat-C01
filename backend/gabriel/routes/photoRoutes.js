const express = require("express");
const {getMyDishes, createPhoto, removePhoto} = require("../controllers/photoController") //takes function out of controller exports
const {requireAuth, requireRole} = require("../../middleware/auth");
const uploadPhoto = require("../middleware/uploadPhoto");


const router = express.Router(); //makes a mini-app that holds all the routes

router.get("/photos/my-dishes", requireAuth, requireRole("child"), getMyDishes); // handles GET requests to photo
router.post("/photos", requireAuth, requireRole("child"), uploadPhoto, createPhoto);
router.delete("/photos/:id", requireAuth, requireRole("child"), removePhoto);
//requireAuth checks if theres a valid token and sets req.user for req.user.id
//requireRole("child") only lets child accounts through, parents results in a 403 error
//getHome only runs if the 2 requireAuth and requireRole is checked and passed

module.exports = router;