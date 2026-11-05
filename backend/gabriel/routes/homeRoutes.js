const express = require("express");
const {getHome} = require("../controllers/homeController") //takes getHome out of controller exports
const {requireAuth, requireRole} = require("../../middleware/auth");


const router = express.Router(); //makes a mini-app that holds all the routes

router.get("/home", requireAuth, requireRole("child"), getHome); // handles GET requests to home
//requireAuth checks if theres a valid token and sets req.user for req.user.id
//requireRole("child") only lets child accounts through, parents results in a 403 error
//getHome only runs if the 2 requireAuth and requireRole is checked and passed

module.exports = router;