import { Mongo } from "meteor/mongo";
import {check} from "meteor/check";

export const Loader = new Mongo.Collection('loader');

if (Meteor.isServer) {
    Meteor.publish('loader', function loaderPublication() {
        return Loader.find({});
    });
}

Meteor.methods({
    'loader.insert'(email, percentage, description) {
        check(email, String);
        Loader.insert({
            email: email,
            percentage: percentage,
            description: description
        });
    },
    'loader.removeAll'(email) {
        check(email, String);
        Loader.remove({
            email: email
        });
    },
});
