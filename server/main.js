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
        let pathToFile = Meteor.absolutePath;
        let promise = new Promise((resolve, reject) => {
            importData();
            readStackExchangeXML('Posts.xml');
            resolve(true);
        });
        promise.then(() => {
            console.log("Seed finished");
        });
    }
}
