import "../imports/api/posts.js";
import "../imports/api/ratings.js";
import "../imports/api/surveis.js";
import {Meteor} from "meteor/meteor";
import "./utils.js";
import {readStackExchangeXML} from "./readStackExchange";
import {importData} from "./mongoimporter";

Meteor.startup(() => {
    seed();
});

function seed() {
    if (Meteor.users.find({}).count() == 0) {
        console.log("Seeding data");
        let promise = new Promise((resolve, reject) => {
            //let path = Assets.absoluteFilePath("Posts.zip");
            var pathToFile = Meteor.absolutePath;
            extractZip(pathToFile +"/private/Posts.zip", pathToFile+"/private", true, function(error)
            {
                if (error) console.log("Error extracting ZIP file: " + error);
            });
            importData();
            readStackExchangeXML('Posts.xml');
            resolve(true);
        });

        promise.then(() => {
            console.log("Seed finished");
        });
    }
}
