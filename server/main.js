import "../imports/api/posts.js";
import "../imports/api/ratings.js";
import "../imports/api/surveis.js";
import {Meteor} from "meteor/meteor";
import "./utils.js";
import {readStackExchangeXML} from "./readStackExchange";
import {importData} from "./mongoimporter";

Meteor.startup(() => {
    WebApp.connectHandlers.use(function(req, res, next) {
      res.setHeader("Access-Control-Allow-Credentials", true);
      res.setHeader("Access-Control-Allow-Origin", "*");
      return next();
    });
    seed();
});
function seed() {
    if (Meteor.users.find({}).count() == 0) {
        console.log("Seeding data");
        let pathToFile = Meteor.absolutePath;
        let promise = new Promise((resolve, reject) => {
            //let path = Assets.absoluteFilePath("Posts.zip");
            /*extractZip(pathToFile +"/private/Posts.zip", pathToFile+"/private", false, function(error)
            {
                if (error) console.log("Error extracting ZIP file: " + error);
            });*/
            importData();
            readStackExchangeXML('Posts.xml');
            resolve(true);
        });
        promise.then(() => {
            console.log("Seed finished");
        });
    }
}
