const homeModel = require('../models/homeModel');

async function getHome(req, res, next) {
    try{
        const childId = req.user.id; // who is requesting

        const child = await homeModel.getChildSummary(childId); // get the data from the database using the query in the model
        //await means to wait for the database to answer before moving on
        if (!child) return res.status(404).json({error: "Child not found"}); 
        //if the id doesnt match the child, child is undefined daily limit would crash if not checked

        const spent = await homeModel.getSpentToday(childId); // same as the home.getchildsummary

        const dailyLimit = Number(child.daily_limit);
        const spentToday = Number(spent); // Number function turns it from a text to a number
        const left = Math.max(dailyLimit - spentToday, 0); // arranging the data pulled from the 2 await funcs
        //Math.max stops left from being negative if somehow overspent (x,0) takes the left parameter
        //in this case (dailyLimit - spentToday) and checks if its bigger than 0 so anything below 0 becomes 0

        res.json({ // respond with data pulled using the query
            child: {name : child.display_name, avatarEmoji: child.avatar_emoji},
            money: {left, spentToday, dailyLimit}, // arranged data from the lines 14-16
        });
    
    }
    catch (err){
        next(err);
    }
}

module.exports = {getHome};