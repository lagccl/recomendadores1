import { Mongo } from "meteor/mongo";
import {check} from "meteor/check";

export const Loader = new Mongo.Collection('loader');

if (Meteor.isServer) {
    Meteor.publish('loader', function loaderPublication() {
        return Loader.find({});
    });
}

Meteor.methods({
    'loader.insert'(name, percentage, description) {
        check(name, String);
        Loader.insert({
            name: name,
            percentage: percentage,
            description: description
        });
    },
    'loader.removeAll'(name) {
        check(name, String);
        Loader.remove({
            name: name
        });
    },
});
