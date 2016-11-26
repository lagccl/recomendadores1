import "newrelic"
import "../imports/api/posts.js";
import "../imports/api/ratings.js";
import "../imports/api/surveis.js";
import {Meteor} from "meteor/meteor";
import "./utils.js";
import {importData} from "./mongoimporter";

Meteor.startup(() => {
  //process.env.DISABLE_WEBSOCKETS = 1;
    seed();
});
function seed() {
    if (Meteor.users.find({}).count() == 0) {
        console.log("Seeding data");
        let promise = new Promise((resolve) => {
            importData();
            resolve(true);
        });
        promise.then((result) => {
            console.log("Finished data " + result);
        });
    }
}
