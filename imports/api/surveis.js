import {Meteor} from "meteor/meteor";
import {Mongo} from "meteor/mongo";
import {check} from "meteor/check";

export const Surveis = new Mongo.Collection('surveis');

if (Meteor.isServer) {
    Meteor.publish('surveis', function surveisPublication() {
        return Surveis.find({});
    });
}

Meteor.methods({
    'survey.insert'(email, p1, p2, p3, p4, p5, opinion) {
        check(email, String);
        Surveis.insert({
            createdAt: new Date(),
            email: email,
            p1: p1,
            p2: p2,
            p3: p3,
            p4: p4,
            p5: p5,
            opinion: opinion
        });
    },
    'survey.removeAll'(email) {
        check(email, String);
        Surveis.remove({
            email: email
        });
    },
});
